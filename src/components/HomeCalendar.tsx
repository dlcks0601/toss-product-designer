'use client';

import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
export const DAY_END = 1080;

/** 주 인덱스를 0..WEEK_COUNT-1로 클램프한다. */
export function clampWeek(index: number): number {
  return Math.min(Math.max(index, 0), WEEK_COUNT - 1);
}

/** weekIndex(0~2) → 그 주 월~금 ISO 5일. 범위 밖 인덱스는 클램프된다. */
export function weekDays(weekIndex: number): string[] {
  const monday = addDaysISO(FIRST_MONDAY, clampWeek(weekIndex) * 7);
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(monday, i));
}

/** 월간 피커 그리드 — 2026년 7월(일요일 시작), 앞뒤 달 채움 포함 35칸. */
export function buildMonthCells(): { day: string; inMonth: boolean }[] {
  // 7/1(수) 기준 일요일 시작 → 6/28(일)부터 35일.
  return Array.from({ length: 35 }, (_, i) => {
    const day = addDaysISO('2026-06-28', i);
    return { day, inMonth: day.startsWith('2026-07') };
  });
}

/** 해당 날짜가 속한 주 인덱스(0..WEEK_COUNT-1) — 주간 뷰 범위 밖이면 -1. */
export function weekIndexOfDay(day: string): number {
  for (let w = 0; w < WEEK_COUNT; w += 1) {
    if (weekDays(w).includes(day)) return w;
  }
  return -1;
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
  meeting: { bg: '#DFF9FE', border: '#BEEFFB', title: '#0099FF', sub: '#5CB8F5' },
  focus: { bg: '#DFF4E7', border: '#BEE3CF', title: '#12A150', sub: '#5FC08D' },
  lunch: { bg: '#F2F4F6', border: 'rgba(229,232,235,0.6)', title: '#8B95A1', sub: '#B0B8C1' },
  personal: { bg: '#F1ECFE', border: '#DED3F8', title: '#7C4DFF', sub: '#A98BF0' },
  offsite: {
    bg: '#FEF0F1',
    border: '#F3DBDB',
    title: '#F04452',
    sub: '#EE99A0',
    stripes:
      'repeating-linear-gradient(135deg, rgba(240,68,82,0.06) 0 4px, transparent 4px 9px)',
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

/** 외부/타팀과 함께하는 미팅 — 내부 미팅(파랑)과 구분되는 옐로우그린. */
export const EXTERNAL_STYLE: KindStyle = { bg: '#F0FED9', border: '#DCF0AC', title: '#7CBE00', sub: '#A4D440' };

/** 이벤트별 표시 스타일 — 회의 중 external은 옐로우그린, 그 외는 종류별 팔레트. */
export function styleFor(ev: CalendarEvent): KindStyle {
  return ev.kind === 'meeting' && ev.external ? EXTERNAL_STYLE : KIND_STYLE[ev.kind];
}

// 응답대기(받은 초대) 고스트 — 평소엔 점선 유령, 호버하면 솔리드 블루로 차오르며 떠오른다.
// 그림자는 애니메이션 금지 원칙(성능)에 따라 after: 오버레이의 opacity로만 켠다.
const GHOST_CARD =
  // isolate: after:-z-10 글로우가 조상 배경 뒤로 꺼지지 않게 버튼 자신을 스태킹 컨텍스트로.
  'group relative isolate border-2 border-dashed border-[#DFF9FE] bg-transparent ' +
  'transition-[background-color,border-color] duration-200 hover:z-10 hover:border-transparent hover:bg-primary ' +
  'after:pointer-events-none after:absolute after:-inset-px after:-z-10 after:rounded-[inherit] ' +
  'after:shadow-[0_10px_32px_rgba(89,149,245,0.6)] after:opacity-0 after:transition-opacity after:duration-200 hover:after:opacity-100';
const GHOST_TITLE_CLS = 'text-[#0099FF] transition-colors duration-200 group-hover:text-white';
const GHOST_SUB_CLS = 'text-[#5CB8F5] transition-colors duration-200 group-hover:text-white/80';

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
  // 오전/오후 없이 시각만 — 9시~12시, 1시~6시(오후는 12시간 표기).
  return `${h <= 12 ? h : h - 12}시`;
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
    <div className="mt-2 space-y-2.5">
      {events.slice(0, ghostIndex === -1 ? events.length : ghostIndex).map((ev) => (
        <MobileEventRow key={ev.id} ev={ev} badges={badgesFor(ev)} />
      ))}
      {ghost && (
        <button
          type="button"
          onClick={onOpenInvite}
          className={`pressable w-full rounded-2xl px-4 py-3.5 text-left ${GHOST_CARD}`}
        >
          <p className={`truncate text-[14px] font-semibold ${GHOST_TITLE_CLS}`}>{ghost.title}</p>
          <p className={`mt-0.5 text-[12px] ${GHOST_SUB_CLS}`}>{fmtRange(ghost.start, ghost.end)} · 응답 대기</p>
        </button>
      )}
      {ghostIndex !== -1 &&
        events.slice(ghostIndex).map((ev) => <MobileEventRow key={ev.id} ev={ev} badges={badgesFor(ev)} />)}
    </div>
  );
}

function MobileEventRow({ ev, badges }: { ev: CalendarEvent; badges?: Person[] | null }) {
  const st = styleFor(ev);
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ backgroundColor: st.bg, backgroundImage: st.stripes }}>
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
  const reduced = !!useReducedMotion();
  const [week, setWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [monthOpen, setMonthOpen] = useState(false);
  // 주 넘김 방향(±1) — 전환 페이드가 이 방향으로 살짝 흐른다(다음 주 = 오른쪽에서 들어옴).
  const [dir, setDir] = useState(1);
  const days = weekDays(week);
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i);

  const goWeek = (delta: number) => {
    const next = clampWeek(week + delta);
    if (next === week) return;
    setDir(delta > 0 ? 1 : -1);
    setWeek(next);
    // 주를 옮기면 모바일 선택일도 따라간다 — 현재 주로 돌아오면 오늘로.
    setSelectedDay(next === 0 ? TODAY : weekDays(next)[0]);
  };

  // 주 전환 페이드 — 페이지가 바뀌듯 이전 주가 사라지고 새 주가 들어온다(방향 인지, 모션은 설명).
  const weekFade = {
    initial: reduced ? { opacity: 1 } : { opacity: 0, x: 20 * dir },
    animate: { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 1 } : { opacity: 0, x: -14 * dir },
    transition: reduced ? { duration: 0 } : { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const },
  };

  const [, month] = days[0].split('-');

  const ghostOn = (day: string) => (invite && invite.day === day ? invite : null);

  // ── 월간 피커 — '7월' 탭으로 열리고, 일정 있는 날엔 점, 날짜 탭 = 그 주로 점프 ──
  // 점심은 매일 있어 점의 의미가 사라지므로 제외 — 점 = 진짜 일정(회의·개인·외근 등).
  const dottedDays = new Set(events.filter((e) => e.kind !== 'lunch').map((e) => e.day));
  if (invite) dottedDays.add(invite.day);

  const goToDay = (day: string) => {
    const w = weekIndexOfDay(day);
    if (w === -1) return;
    if (w !== week) {
      setDir(w > week ? 1 : -1);
      setWeek(w);
    }
    setSelectedDay(day);
    setMonthOpen(false);
  };

  return (
    <section aria-label="내 캘린더">
      {/* ── 헤더: 월 + 범위 + 주 이동 + (데스크톱) CTA ── */}
      <div className="flex items-center justify-between">
        <div className="relative flex items-center gap-0.5">
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
            onClick={() => setMonthOpen(!monthOpen)}
            aria-expanded={monthOpen}
            aria-label="월간 달력 열기"
            className="pressable rounded-lg px-1.5 text-[20px] font-bold tracking-[-0.02em] text-text-strong hover:bg-section lg:text-[22px]"
          >
            {Number(month)}월
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

          {/* 월간 피커 팝오버 — 토스 방식: 일~토 그리드, 오늘=파란 칩, 일정 있는 날=점 */}
          <AnimatePresence>
            {monthOpen && (
              <>
                <div className="fixed inset-0 z-[60]" aria-hidden onClick={() => setMonthOpen(false)} />
                <motion.div
                  key="month-picker"
                  role="dialog"
                  aria-label="2026년 7월"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                  transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 350, damping: 30 }}
                  style={{ transformOrigin: 'top left' }}
                  className="absolute left-0 top-full z-[65] mt-2 w-[340px] rounded-[24px] bg-white p-5 shadow-[0_16px_40px_rgba(25,31,40,0.14),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60"
                >
                  <div className="grid grid-cols-7 pb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                      <span key={d} className="py-1 text-center text-[13px] text-text-faint">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-3">
                    {buildMonthCells().map(({ day, inMonth }) => {
                      const navigable = inMonth && weekIndexOfDay(day) !== -1;
                      const today = day === TODAY;
                      const dotted = inMonth && dottedDays.has(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!navigable}
                          onClick={() => goToDay(day)}
                          className={`pressable relative mx-auto flex h-10 w-10 items-center justify-center rounded-[13px] text-[16px] font-semibold ${
                            today
                              ? 'bg-primary text-white'
                              : navigable
                                ? 'text-text-strong hover:bg-section'
                                : inMonth
                                  ? 'text-text-faint'
                                  : 'text-border'
                          } disabled:pointer-events-none`}
                        >
                          {dayNumber(day)}
                          {dotted && !today && (
                            <span aria-hidden className="absolute bottom-[3px] h-1 w-1 rounded-full bg-primary/60" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
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
      <div className="mt-3 hidden overflow-hidden rounded-[20px] bg-white px-2 lg:block">
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={week} {...weekFade}>
        {/* 요일 헤더 */}
        <div className="flex border-b border-border/70">
          <div className="w-[44px] shrink-0" aria-hidden />
          {days.map((day, i) => {
            const today = day === TODAY;
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
                {/* 요일 위 + 날짜 아래 — 모바일과 같은 세로 스택(토스 문법), 높이는 압축. */}
                <span className={`text-[10.5px] leading-4 ${today ? 'font-semibold text-primary' : 'text-text-weak'}`}>
                  {WEEKDAY_LABELS[i]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold ${
                    today ? 'bg-primary text-white' : 'text-text-strong'
                  }`}
                >
                  {dayNumber(day)}
                </span>
              </div>
            );
          })}
        </div>
        {/* 본문 — 시각 영역을 상하 여백(inset-y-4)으로 감싸 라벨/이벤트가 가장자리에 붙지 않게 한다. */}
        <div className="relative h-[640px]">
          <div className="absolute inset-x-0 inset-y-4 flex">
          {/* 시각 라벨 — 9시~6시 균등 배치. 처음은 위 정렬, 끝은 아래 정렬, 중간은 중앙 정렬. */}
          <div className="relative w-[44px] shrink-0" aria-hidden>
            {hours.map((h, i) => {
              const first = i === 0;
              const last = i === hours.length - 1;
              return (
                <span
                  key={h}
                  className={`absolute right-2 text-[11px] text-text-faint ${first ? '' : last ? '-translate-y-full' : '-translate-y-1/2'}`}
                  style={{ top: `${(i / (hours.length - 1)) * 100}%` }}
                >
                  {hourLabel(h)}
                </span>
              );
            })}
          </div>
          {days.map((day) => {
            const ghost = ghostOn(day);
            return (
              <div key={day} className="relative flex-1">
                {eventsOn(events, day).map((ev) => {
                  const top = yPct(ev.start);
                  const height = yPct(ev.end) - top;
                  const compact = ev.end - ev.start < 50;
                  const st = styleFor(ev);
                  const badges =
                    responseBadges && responseBadges.eventId === ev.id && responseBadges.people.length > 0
                      ? responseBadges.people
                      : null;
                  return (
                    <div
                      key={ev.id}
                      className="absolute inset-x-1.5 overflow-hidden rounded-xl px-3 py-2"
                      style={{ top: `calc(${top}% + 3px)`, height: `calc(${height}% - 6px)`, backgroundColor: st.bg, backgroundImage: st.stripes }}
                    >
                      <p className="truncate text-[13px] font-bold leading-[1.3]" style={{ color: st.title }}>
                        {ev.title}
                      </p>
                      {!compact && (
                        <p className="truncate text-[11px] font-medium leading-[1.3]" style={{ color: st.sub }}>
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
                    className={`pressable absolute inset-x-1.5 rounded-xl px-3 py-2 text-left ${GHOST_CARD}`}
                    style={{
                      top: `calc(${yPct(ghost.start)}% + 3px)`,
                      height: `calc(${yPct(ghost.end) - yPct(ghost.start)}% - 6px)`,
                    }}
                  >
                    <p className={`truncate text-[13px] font-bold leading-[1.3] ${GHOST_TITLE_CLS}`}>{ghost.title}</p>
                    <p className={`truncate text-[11px] font-medium leading-[1.3] ${GHOST_SUB_CLS}`}>
                      {fmtRange(ghost.start, ghost.end)} · 응답 대기
                    </p>
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </div>
        </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 모바일: 요일 칩 + 하루 목록 ── */}
      <div className="mt-2 lg:hidden">
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={week} {...weekFade}>
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

        {/* 요일 탭 전환도 살짝 페이드 — 주 전환(바깥 키)보다 조용하게. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedDay}
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.1, ease: 'easeOut' }}
          >
            <MobileDayList
              events={eventsOn(events, selectedDay)}
              ghost={ghostOn(selectedDay)}
              onOpenInvite={onOpenInvite}
              responseBadges={responseBadges}
            />
          </motion.div>
        </AnimatePresence>
        </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
