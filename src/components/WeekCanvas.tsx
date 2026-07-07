'use client';

import { memo, useMemo, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Attendee, CandidateSlot } from '../lib/types';
import { HARD_BLOCK_KINDS } from '../lib/partial';
import { fmtDayKorean, fmtRange, fmtTime, overlaps, weekdayIndex, type Minutes } from '../lib/time';

/**
 * 주간 캔버스 — 시간 찾기 PC(히어로 2/2)의 지도. 캘린더가 지도이고 이유 카드가 장소 카드다.
 *
 * 세 레이어:
 *  1. 팀 일정 = 무채색 밀도 지형 — 30분 칸마다 "진짜로 안 되는 사람 수"(하드 블로커만,
 *     CandidateGrid의 densityBins와 같은 의미론)를 grey 농도로 깐다. 개별 제목은 절대
 *     노출하지 않는다 — 셀 호버 시 '바쁜 사람 N명 — {이름…}' 툴팁(CSS group-hover)만.
 *  2. 후보 = 파란 tint 밴드(radius 8, border #C9E2FF) — visible 5개. 호버 글로우는
 *     ring 오버레이의 opacity + scale 마이크로만 쓴다(성능 철칙: transform/opacity·정적 그림자).
 *  3. 선택 = 솔리드 파랑 카드(흰 텍스트: 회의 제목 또는 시각) — 제자리 팝 스프링 {500,18}.
 *
 * 상호 하이라이트: hoveredId는 부모(FindTimeDesktop)가 소유 — 레일 카드 호버 ↔ 밴드 글로우가
 * 같은 상태 하나로 양방향이 된다. 조건 변경 시 밴드는 layout FLIP(스프링 {350,30})으로 재배치.
 *
 * 키보드: 캔버스 포커스 시 ←→로 visible 후보 순회(cycleSlot), Enter로 확정. 공지는 부모 aria-live.
 * 성능: 밀도 열·밴드 전부 memo — hoveredId가 바뀌어도 지형은 다시 그리지 않는다.
 */

// ── 프레임 상수 — 9:00~19:00(홈 캘린더와 동일한 세로 프레임), 30분 칸 20개 ──
export const CANVAS_START: Minutes = 540;
export const CANVAS_END: Minutes = 1140;
export const CANVAS_BIN: Minutes = 30;
export const CANVAS_BIN_COUNT = (CANVAS_END - CANVAS_START) / CANVAS_BIN;

// ── 순수 헬퍼(WeekCanvas.test.ts가 계약) ─────────────────────────────

/** 분 → 세로 위치(%). 프레임 밖은 클램프. */
export function canvasYPct(minutes: Minutes): number {
  const clamped = Math.min(Math.max(minutes, CANVAS_START), CANVAS_END);
  return ((clamped - CANVAS_START) / (CANVAS_END - CANVAS_START)) * 100;
}

/**
 * 해당 30분 칸에서 "바쁜"(하드 블로킹 일정이 겹치는) 사람 이름들 — 참석자 순서 그대로.
 * lunch·focus는 후보를 막지 않으므로(soft) 세지 않는다 — 밀도의 의미는 그리드와 동일하게
 * "이 시간대는 이만큼의 사람이 진짜로 안 된다"이다.
 */
export function busyPeopleAt(attendees: readonly Attendee[], day: string, binStart: Minutes): string[] {
  const names: string[] = [];
  for (const a of attendees) {
    const busy = a.events.some(
      (e) => e.day === day && HARD_BLOCK_KINDS.has(e.kind) && overlaps(binStart, binStart + CANVAS_BIN, e.start, e.end),
    );
    if (busy) names.push(a.name);
  }
  return names;
}

/** 해당 30분 칸의 바쁜 사람 수 — 밀도 농도의 근거. */
export function busyCountAt(attendees: readonly Attendee[], day: string, binStart: Minutes): number {
  return busyPeopleAt(attendees, day, binStart).length;
}

/** 셀 툴팁 문장 — '바쁜 사람 N명 — 이름, 이름, 이름 외 N'. 이름은 최대 3명. */
export function busyLabel(names: readonly string[]): string {
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length - 3;
  return `바쁜 사람 ${names.length}명 — ${shown}${rest > 0 ? ` 외 ${rest}` : ''}`;
}

/** 바쁜 사람 수 → grey 농도(0명 투명 → 전원 ≈0.49). 지형은 회색 하나의 농도로만 말한다. */
export function densityAlpha(count: number, total: number): number {
  if (count <= 0 || total <= 0) return 0;
  return Number((0.07 + 0.42 * Math.min(count / total, 1)).toFixed(3));
}

/**
 * 키보드 순회 — visible 후보 id 배열에서 현재 선택의 다음/이전(순환).
 * 선택이 없거나 목록 밖이면 →는 첫 후보, ←는 마지막 후보부터 시작한다.
 */
export function cycleSlot(ids: readonly string[], currentId: string | null, dir: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const idx = currentId === null ? -1 : ids.indexOf(currentId);
  if (idx === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(idx + dir + ids.length) % ids.length];
}

// ── 내부 조각 ───────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
/** 위치 이동 스프링 — 조건 변경 FLIP(리스트·셋업과 같은 {350,30} 규칙). */
const POSITION_SPRING = { type: 'spring' as const, stiffness: 350, damping: 30 };
/** 선택 팝 스프링 — 솔리드 카드의 제자리 등장. */
const POP_SPRING = { type: 'spring' as const, stiffness: 500, damping: 18 };

function hourLabel(h: number): string {
  return h < 12 ? `오전 ${h}시` : h === 12 ? '오후 12시' : `오후 ${h - 12}시`;
}

/** '10:00' — 밴드 안 짧은 시각(24h, 칼럼이 좁다). */
function shortTime(m: Minutes): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * 하루 밀도 열 — 셀은 전부 정적(CSS group-hover 툴팁), hoveredId가 바뀌어도 재렌더 없음(memo).
 * 툴팁은 첫/끝 열에서 좌우로, 상단 두 칸에서는 아래로 붙여 캔버스 밖으로 나가지 않는다.
 */
const DensityColumn = memo(function DensityColumn({
  attendees,
  day,
  colIndex,
  colCount,
}: {
  attendees: Attendee[];
  day: string;
  colIndex: number;
  colCount: number;
}) {
  const cells: { bin: number; names: string[] }[] = [];
  for (let bin = 0; bin < CANVAS_BIN_COUNT; bin++) {
    const names = busyPeopleAt(attendees, day, CANVAS_START + bin * CANVAS_BIN);
    if (names.length > 0) cells.push({ bin, names });
  }
  const alignX =
    colIndex === 0 ? 'left-1' : colIndex === colCount - 1 ? 'right-1' : 'left-1/2 -translate-x-1/2';
  return (
    <div className="relative flex-1 border-l border-border/50">
      {cells.map(({ bin, names }) => (
        <div
          key={bin}
          className="group absolute inset-x-0"
          style={{
            top: `${(bin / CANVAS_BIN_COUNT) * 100}%`,
            height: `${100 / CANVAS_BIN_COUNT}%`,
            backgroundColor: `rgba(139,149,161,${densityAlpha(names.length, attendees.length)})`,
          }}
        >
          <span
            className={`pointer-events-none absolute z-30 hidden whitespace-nowrap rounded-lg bg-text-strong/95 px-2.5 py-1.5 text-[12px] font-medium leading-none text-white group-hover:block ${
              bin < 2 ? 'top-full mt-1' : 'bottom-full mb-1'
            } ${alignX}`}
          >
            {busyLabel(names)}
          </span>
        </div>
      ))}
    </div>
  );
});

/** 후보 밴드 — tint(기본) / 글로우(호버, ring opacity+scale 마이크로) / 솔리드 팝(선택). */
const Band = memo(function Band({
  slot,
  dayIndex,
  dayCount,
  selected,
  hovered,
  title,
  reduced,
  onHover,
  onSelect,
}: {
  slot: CandidateSlot;
  dayIndex: number;
  dayCount: number;
  selected: boolean;
  hovered: boolean;
  title: string;
  reduced: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const top = canvasYPct(slot.start);
  const height = canvasYPct(slot.end) - top;
  const compact = slot.end - slot.start < 50;
  return (
    <motion.button
      type="button"
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={POSITION_SPRING}
      onClick={() => onSelect(slot.id)}
      onMouseEnter={() => onHover(slot.id)}
      onMouseLeave={() => onHover(null)}
      aria-pressed={selected}
      aria-label={`${fmtDayKorean(slot.day)} ${fmtTime(slot.start)} 후보${selected ? ' — 선택됨' : ''}`}
      className={`pointer-events-auto absolute text-left ${selected ? 'z-20' : hovered ? 'z-10' : 'z-[5]'}`}
      style={{
        top: `${top}%`,
        height: `calc(${height}% - 2px)`,
        left: `calc(${(dayIndex * 100) / dayCount}% + 4px)`,
        width: `calc(${100 / dayCount}% - 8px)`,
      }}
    >
      {/* 기본 밴드 — 파란 tint. 호버 시 스케일 마이크로(transform만). */}
      <span
        className={`absolute inset-0 block rounded-[8px] border border-[#C9E2FF] bg-[#E8F3FF]/90 transition-transform duration-200 ease-out ${
          hovered && !selected && !reduced ? 'scale-[1.03]' : ''
        }`}
      >
        <span className="absolute left-2 top-[5px] text-[11px] font-semibold leading-none text-primary">
          {shortTime(slot.start)}
        </span>
      </span>
      {/* 글로우 링 — opacity만 전환(박스섀도 애니메이션 금지). */}
      <span
        aria-hidden
        className={`absolute -inset-[3px] block rounded-[11px] ring-2 ring-primary/45 transition-opacity duration-200 ease-out ${
          hovered && !selected ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* 선택 — 솔리드 파랑 카드(정적 그림자), 제자리 팝 {500,18}. */}
      {selected && (
        <motion.span
          initial={reduced ? false : { scale: 0.9, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={POP_SPRING}
          className="absolute inset-0 block overflow-hidden rounded-[8px] bg-primary px-2 py-[5px] shadow-[0_6px_18px_rgba(49,130,246,0.35)]"
        >
          <span className="block truncate text-[12px] font-semibold leading-[1.35] text-white">
            {title || fmtTime(slot.start)}
          </span>
          {!compact && (
            <span className="block truncate text-[11px] leading-[1.4] text-white/75">
              {fmtRange(slot.start, slot.end)}
            </span>
          )}
        </motion.span>
      )}
    </motion.button>
  );
});

// ── 본체 ────────────────────────────────────────────────────────────

export interface WeekCanvasProps {
  /** 이번에 보여줄 주의 영업일(기한 창 안) — 이번 주 잔여 3일이면 3열. */
  days: string[];
  /** 팀 전체 참석자 — 밀도 지형의 근거(각자의 events를 읽는다). */
  attendees: Attendee[];
  /** 표시 후보(visible 5) — days 밖 주의 후보는 밴드를 그리지 않는다. */
  candidates: CandidateSlot[];
  selectedId: string | null;
  hoveredId: string | null;
  /** 선택 솔리드 카드의 라벨 — 비어 있으면 시각으로 폴백. */
  title: string;
  onHover: (id: string | null) => void;
  /** 밴드 탭·키보드 순회 — 부모가 카드 확장·주 전환·스크롤 동기까지 처리한다. */
  onSelect: (id: string) => void;
  /** Enter 확정 — 캔버스 프레임 포커스 시에만. */
  onConfirm: () => void;
  reduced: boolean;
}

export default function WeekCanvas({
  days,
  attendees,
  candidates,
  selectedId,
  hoveredId,
  title,
  onHover,
  onSelect,
  onConfirm,
  reduced,
}: WeekCanvasProps) {
  const hours = Array.from({ length: (CANVAS_END - CANVAS_START) / 60 + 1 }, (_, i) => CANVAS_START / 60 + i);
  const visibleIds = useMemo(() => candidates.map((s) => s.id), [candidates]);
  const dayIndex = useMemo(() => new Map(days.map((d, i) => [d, i])), [days]);
  const bands = candidates.filter((s) => dayIndex.has(s.day));

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = cycleSlot(visibleIds, selectedId, e.key === 'ArrowRight' ? 1 : -1);
      if (next !== null) onSelect(next);
    } else if (e.key === 'Enter' && e.target === e.currentTarget && selectedId !== null) {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <section aria-label="주간 캔버스" className="flex h-full flex-col rounded-[20px] bg-white ring-1 ring-border/70">
      {/* 요일 헤더 */}
      <div className="flex border-b border-border/70">
        <div className="w-[52px] shrink-0" aria-hidden />
        {days.map((day) => (
          <div key={day} className="flex flex-1 items-center justify-center gap-1.5 border-l border-border/50 py-2.5">
            <span className="text-[12px] text-text-weak">{WEEKDAY_LABELS[weekdayIndex(day)]}</span>
            <span className="text-[15px] font-semibold text-text-strong">{Number(day.slice(8, 10))}</span>
          </div>
        ))}
      </div>

      {/* 본문 — 포커스 대상(←→ 순회, Enter 확정) */}
      <div className="min-h-0 flex-1 pb-2">
        <div
          role="group"
          tabIndex={0}
          onKeyDown={handleKey}
          aria-label="주간 캔버스 — 왼쪽·오른쪽 화살표로 추천 시간을 이동하고 Enter로 확정해요"
          className="relative flex h-full rounded-b-[18px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {/* 시각 라벨 */}
          <div className="relative w-[52px] shrink-0" aria-hidden>
            {hours.slice(1, -1).map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-text-faint"
                style={{ top: `${((i + 1) / (hours.length - 1)) * 100}%` }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {/* 시간선 */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[52px] right-0">
            {hours.slice(1, -1).map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/40"
                style={{ top: `${((i + 1) / (hours.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          {/* 팀 일정 밀도 지형 — 열 단위 memo */}
          {days.map((day, i) => (
            <DensityColumn key={day} attendees={attendees} day={day} colIndex={i} colCount={days.length} />
          ))}

          {/* 후보 밴드 오버레이 — 열 경계를 넘어 FLIP(요일 이동도 한 평면에서). */}
          <div className="pointer-events-none absolute inset-y-0 left-[52px] right-0">
            <AnimatePresence initial={false}>
              {bands.map((slot) => (
                <Band
                  key={slot.id}
                  slot={slot}
                  dayIndex={dayIndex.get(slot.day)!}
                  dayCount={days.length}
                  selected={slot.id === selectedId}
                  hovered={slot.id === hoveredId}
                  title={title}
                  reduced={reduced}
                  onHover={onHover}
                  onSelect={onSelect}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
