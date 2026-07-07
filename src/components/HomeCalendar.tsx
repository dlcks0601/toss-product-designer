'use client';

import { useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Avatar from './Avatar';
import type { CalendarEvent, EventKind, Person } from '../lib/types';
import { addDaysISO, fmtRange } from '../lib/time';

/**
 * 홈 캘린더 — 내(이찬) 주간 일정 + 캘린더 안에 살고 있는 받은 초대(고스트 이벤트).
 *
 * 데스크톱(lg+): 월~금 5열 × 9~19시 주간 그리드. 모바일: 요일 칩 + 하루 목록.
 * 주 이동은 7/6 주 ~ 7/20 주(3주, 데이터가 있는 범위)에서 클램프. 드래그 없음 — 보기 전용.
 * 오늘(7/7 화)은 요일 라벨 밑 파란 점으로만 은은하게 표시한다.
 *
 * responseBadges: 확정 회의 블록에 얹는 응답 아바타 미니 스택 — 응답 토스트가
 * 도착할 때마다(page.tsx가 people을 늘려 내려준다) 한 명씩 팝으로 채워진다.
 */

// ── 주(週) 헬퍼 — 순수 함수(HomeCalendar.test.ts가 계약) ──────────────

/** 데모 세계의 오늘(앵커) — 2026-07-07 화. */
export const TODAY = '2026-07-07';
/** 홈에서 볼 수 있는 첫 주의 월요일. */
export const FIRST_MONDAY = '2026-07-06';
/** 이벤트가 존재하는 주 수(7/6~7/24). */
export const WEEK_COUNT = 3;
/** 그리드 세로 프레임 — 9시~19시. */
export const DAY_START = 540;
export const DAY_END = 1140;

/** 주 인덱스를 0..WEEK_COUNT-1로 클램프한다. */
export function clampWeek(index: number): number {
  return Math.min(Math.max(index, 0), WEEK_COUNT - 1);
}

/** weekIndex(0~2) → 그 주 월~금 ISO 5일. 범위 밖 인덱스는 클램프된다. */
export function weekDays(weekIndex: number): string[] {
  const monday = addDaysISO(FIRST_MONDAY, clampWeek(weekIndex) * 7);
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(monday, i));
}

/** 분(자정 기준) → 그리드 세로 위치(%) — 9~19시 프레임 기준, 프레임 밖은 클램프. */
export function yPct(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, DAY_START), DAY_END);
  return ((clamped - DAY_START) / (DAY_END - DAY_START)) * 100;
}

/** 하루치 이벤트 — day 일치만 골라 시작 시각 순으로 정렬한다. */
export function eventsOn(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((e) => e.day === day).sort((a, b) => a.start - b.start);
}

// ── 이벤트 종류별 틴트 — 차분한 파스텔, 색만으로 소리치지 않는다 ──────────
// (ProfilePeek 미니 캘린더가 같은 팔레트를 공유한다 — 단일 소스)

export interface KindStyle {
  bg: string;
  border: string;
  title: string;
  sub: string;
  /** offsite 전용 — 은은한 사선 스트라이프 */
  stripes?: string;
}

export const KIND_STYLE: Record<EventKind, KindStyle> = {
  meeting: { bg: '#E8F3FF', border: '#C9E2FF', title: '#1B64DA', sub: '#7CA5E8' },
  focus: { bg: '#D9F0E4', border: '#BEE3CF', title: '#13774A', sub: '#66AE88' },
  lunch: { bg: '#F2F4F6', border: 'rgba(229,232,235,0.6)', title: '#8B95A1', sub: '#B0B8C1' },
  personal: { bg: '#F1EDFD', border: '#DED3F8', title: '#6440C8', sub: '#A28BE0' },
  offsite: {
    bg: '#FBF1F1',
    border: '#F3DBDB',
    title: '#C2454F',
    sub: '#DB959B',
    stripes:
      'repeating-linear-gradient(135deg, rgba(240,68,82,0.05) 0 4px, transparent 4px 9px)',
  },
};

export function kindBoxStyle(kind: EventKind): CSSProperties {
  const st = KIND_STYLE[kind];
  return {
    backgroundColor: st.bg,
    backgroundImage: st.stripes,
    borderColor: st.border,
  };
}

const GHOST_STYLE: CSSProperties = {
  backgroundColor: 'rgba(232,243,255,0.55)',
  borderColor: '#8FC0F9',
};

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'] as const;

// ── 응답 배지 — 확정 회의 블록의 아바타 미니 스택 ─────────────────────

export interface ResponseBadges {
  /** 배지를 얹을 이벤트 id(방금 확정한 회의) */
  eventId: string;
  /** 응답한 사람들 — 도착 순서대로 채워진다 */
  people: Person[];
}

const BADGE_POP = { type: 'spring' as const, stiffness: 500, damping: 18 };

/** 아바타 미니 스택 — 새 응답이 오면 한 명씩 제자리 팝으로 나타난다. */
function BadgeStack({ people }: { people: Person[] }) {
  const reduced = !!useReducedMotion();
  return (
    <span className="flex -space-x-1.5">
      {people.map((p) => (
        <motion.span
          key={p.id}
          initial={reduced ? { opacity: 0 } : { scale: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1 }}
          transition={reduced ? { duration: 0.1 } : BADGE_POP}
          className="rounded-full ring-2 ring-white"
        >
          <Avatar person={p} size={24} />
        </motion.span>
      ))}
    </span>
  );
}

function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}

function hourLabel(h: number): string {
  if (h < 12) return `오전 ${h}시`;
  if (h === 12) return `오후 12시`;
  return `오후 ${h - 12}시`;
}

// ── 모바일 하루 목록 — 일반 이벤트와 고스트 초대를 시각 순으로 섞는다 ──

function MobileDayList({
  events,
  ghost,
  onOpenInvite,
  responseBadges,
}: {
  events: CalendarEvent[];
  ghost: HomeCalendarInvite | null;
  onOpenInvite?: () => void;
  responseBadges?: ResponseBadges | null;
}) {
  if (events.length === 0 && !ghost) {
    return <p className="py-10 text-center text-[13px] text-text-faint">이 날은 일정이 없어요</p>;
  }
  const badgesFor = (ev: CalendarEvent) =>
    responseBadges && responseBadges.eventId === ev.id ? responseBadges.people : null;
  // 고스트를 시작 시각 자리에 끼워 넣는다(안정 정렬 유지).
  const ghostIndex = ghost ? events.filter((e) => e.start <= ghost.start).length : -1;
  return (
    <div className="mt-2 space-y-2">
      {events.slice(0, ghostIndex === -1 ? events.length : ghostIndex).map((ev) => (
        <MobileEventRow key={ev.id} ev={ev} badges={badgesFor(ev)} />
      ))}
      {ghost && (
        <button
          type="button"
          onClick={onOpenInvite}
          className="pressable w-full rounded-xl border border-dashed px-4 py-3 text-left"
          style={GHOST_STYLE}
        >
          <p className="truncate text-[14px] font-semibold text-primary">📩 {ghost.title}</p>
          <p className="mt-0.5 text-[12px] text-primary/60">{fmtRange(ghost.start, ghost.end)} · 응답 대기</p>
        </button>
      )}
      {ghostIndex !== -1 &&
        events.slice(ghostIndex).map((ev) => <MobileEventRow key={ev.id} ev={ev} badges={badgesFor(ev)} />)}
    </div>
  );
}

function MobileEventRow({ ev, badges }: { ev: CalendarEvent; badges?: Person[] | null }) {
  const st = KIND_STYLE[ev.kind];
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={kindBoxStyle(ev.kind)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold" style={{ color: st.title }}>
          {ev.title}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: st.sub }}>
          {fmtRange(ev.start, ev.end)}
          {ev.room ? `, ${ev.room}` : ''}
        </p>
      </div>
      {badges && badges.length > 0 && <BadgeStack people={badges} />}
    </div>
  );
}

// ── 본체 ─────────────────────────────────────────────────────────────

export interface HomeCalendarInvite {
  title: string;
  day: string;
  start: number;
  end: number;
}

export interface HomeCalendarProps {
  /** 내(이찬) 일정 — 전 기간을 넘겨도 주 필터는 여기서 한다. */
  events: CalendarEvent[];
  /** 받은 초대 — 캘린더 안에 고스트(점선) 이벤트로 산다. */
  invite?: HomeCalendarInvite | null;
  onOpenInvite?: () => void;
  /** 데스크톱 캘린더 헤더의 `새 일정 만들기`(모바일 CTA는 페이지가 소유). */
  onNewEvent?: () => void;
  /** 확정 회의 블록의 응답 아바타 스택 — 응답 토스트 도착에 맞춰 채워진다. */
  responseBadges?: ResponseBadges | null;
}

export default function HomeCalendar({ events, invite, onOpenInvite, onNewEvent, responseBadges }: HomeCalendarProps) {
  const [week, setWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const days = weekDays(week);
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i);

  const goWeek = (delta: number) => {
    const next = clampWeek(week + delta);
    if (next === week) return;
    setWeek(next);
    // 주를 옮기면 모바일 선택일도 따라간다 — 현재 주로 돌아오면 오늘로.
    setSelectedDay(next === 0 ? TODAY : weekDays(next)[0]);
  };

  const [, month] = days[0].split('-');
  const rangeLabel = `${dayNumber(days[0])}일 – ${dayNumber(days[4])}일`;

  const ghostOn = (day: string) => (invite && invite.day === day ? invite : null);

  return (
    <section aria-label="내 캘린더">
      {/* ── 헤더: 월 + 범위 + 주 이동 + (데스크톱) CTA ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[20px] font-bold tracking-[-0.02em] text-text-strong lg:text-[22px]">
              {Number(month)}월
            </h2>
            <span className="text-[13px] font-medium text-text-weak lg:text-[14px]">{rangeLabel}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => goWeek(-1)}
              disabled={week === 0}
              aria-label="이전 주"
              className="pressable flex h-8 w-8 items-center justify-center rounded-full text-text-body hover:bg-section disabled:pointer-events-none disabled:text-text-faint"
            >
              <ChevronLeft size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goWeek(1)}
              disabled={week === WEEK_COUNT - 1}
              aria-label="다음 주"
              className="pressable flex h-8 w-8 items-center justify-center rounded-full text-text-body hover:bg-section disabled:pointer-events-none disabled:text-text-faint"
            >
              <ChevronRight size={17} aria-hidden />
            </button>
          </div>
        </div>
        {onNewEvent && (
          <button
            type="button"
            onClick={onNewEvent}
            className="pressable hidden h-10 items-center gap-1.5 rounded-full bg-primary pl-3.5 pr-4 text-[14px] font-semibold text-white hover:bg-primary-pressed lg:inline-flex"
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />새 일정 만들기
          </button>
        )}
      </div>

      {/* ── 데스크톱: 5열 주간 그리드 ── */}
      <div className="mt-3 hidden overflow-hidden rounded-[20px] bg-white ring-1 ring-border/70 lg:block">
        {/* 요일 헤더 */}
        <div className="flex border-b border-border/70">
          <div className="w-[60px] shrink-0" aria-hidden />
          {days.map((day, i) => {
            const today = day === TODAY;
            return (
              <div key={day} className="flex flex-1 items-center justify-center gap-1.5 border-l border-border/50 py-2.5">
                <span className={`text-[12px] ${today ? 'font-semibold text-primary' : 'text-text-weak'}`}>
                  {WEEKDAY_LABELS[i]}
                </span>
                <span className={`text-[15px] font-semibold ${today ? 'text-primary' : 'text-text-strong'}`}>
                  {dayNumber(day)}
                </span>
                {today && <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />}
              </div>
            );
          })}
        </div>
        {/* 본문 */}
        <div className="relative flex h-[560px]">
          {/* 시각 라벨 + 시간선 */}
          <div className="relative w-[60px] shrink-0" aria-hidden>
            {hours.slice(0, -1).map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-text-faint"
                style={{ top: `${(i / (hours.length - 1)) * 100}%` }}
              >
                {i === 0 ? '' : hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const ghost = ghostOn(day);
            return (
              <div key={day} className="relative flex-1 border-l border-border/50">
                {eventsOn(events, day).map((ev) => {
                  const top = yPct(ev.start);
                  const height = yPct(ev.end) - top;
                  const compact = ev.end - ev.start < 50;
                  const st = KIND_STYLE[ev.kind];
                  const badges =
                    responseBadges && responseBadges.eventId === ev.id && responseBadges.people.length > 0
                      ? responseBadges.people
                      : null;
                  return (
                    <div
                      key={ev.id}
                      className="absolute inset-x-1 overflow-hidden rounded-[8px] border px-2 py-[3px]"
                      style={{ top: `${top}%`, height: `calc(${height}% - 2px)`, ...kindBoxStyle(ev.kind) }}
                    >
                      <p className="truncate text-[13px] font-semibold leading-[1.3]" style={{ color: st.title }}>
                        {ev.title}
                      </p>
                      {!compact && (
                        <p className="truncate text-[11px] leading-[1.3]" style={{ color: st.sub }}>
                          {fmtRange(ev.start, ev.end)}
                          {ev.room ? `, ${ev.room}` : ''}
                        </p>
                      )}
                      {badges && (
                        <span className="absolute bottom-[3px] right-1.5">
                          <BadgeStack people={badges} />
                        </span>
                      )}
                    </div>
                  );
                })}
                {ghost && (
                  <button
                    type="button"
                    onClick={onOpenInvite}
                    className="pressable absolute inset-x-1 overflow-hidden rounded-[8px] border border-dashed px-2 py-[3px] text-left"
                    style={{
                      top: `${yPct(ghost.start)}%`,
                      height: `calc(${yPct(ghost.end) - yPct(ghost.start)}% - 2px)`,
                      ...GHOST_STYLE,
                    }}
                  >
                    <p className="truncate text-[13px] font-semibold leading-[1.3] text-primary">📩 {ghost.title}</p>
                    <p className="truncate text-[11px] leading-[1.3] text-primary/60">
                      {fmtRange(ghost.start, ghost.end)} · 응답 대기
                    </p>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 모바일: 요일 칩 + 하루 목록 ── */}
      <div className="mt-2 lg:hidden">
        <div className="grid grid-cols-5">
          {days.map((day, i) => {
            const selected = day === selectedDay;
            const today = day === TODAY;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={selected}
                className="pressable flex flex-col items-center gap-1 rounded-xl py-2"
              >
                <span className={`text-[11px] ${selected || today ? 'font-semibold text-primary' : 'text-text-weak'}`}>
                  {WEEKDAY_LABELS[i]}
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold ${
                    selected ? 'bg-primary text-white' : today ? 'text-primary' : 'text-text-strong'
                  }`}
                >
                  {dayNumber(day)}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${today && !selected ? 'bg-primary' : 'bg-transparent'}`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <MobileDayList
          events={eventsOn(events, selectedDay)}
          ghost={ghostOn(selectedDay)}
          onOpenInvite={onOpenInvite}
          responseBadges={responseBadges}
        />
      </div>
    </section>
  );
}
