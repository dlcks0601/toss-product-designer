'use client';

import { Fragment, useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Aurora from './Aurora';
import Avatar from './Avatar';
import FrostedBar from './FrostedBar';
import Reveal from './Reveal';
import Wordmark from './Wordmark';
import { decisionKey, pickAction } from '../lib/decision';
import { DEADLINE_LABEL, DURATION_LABEL, WINDOW_LABEL } from '../lib/labels';
import { josa } from '../lib/reasons';
import { addDaysISO, fmtDayKorean, fmtTime, weekdayIndex } from '../lib/time';
import { weekLabel, weekMondays } from '../lib/weeks';
import type { Candidates } from '../app-state/useCandidates';
import type { Action, AppState } from '../app-state/reducer';
import type { RelaxationSuggestion } from '../lib/relaxation';
import type { Attendee, CandidateSlot, EventKind } from '../lib/types';

/**
 * 시간 정하기 — 한 칼럼의 층위(헤드라인 → 달력 → 참석자 → 추천 → 확정)를
 * PC에선 반반(좌 달력·참석자 / 우 추천·타임라인·CTA)으로 펼친다. 모바일·PC 단일 구현.
 *
 * 분석 Q1~Q10의 판정이 이 파일의 법이다:
 *  - 헤드라인 = 상태 선언(모두 가능/전부 아쉬움/없음/부분이면 돼요/이 시간뿐).
 *  - 추천순은 기한 창 전체의 상위(같은 날 최대 2 — 날짜 다양성 보정), 달력은 날짜 필터 손잡이.
 *  - 아쉬운 후보는 좋은 답이 있으면 '더 보기' 뒤로, 전부 아쉬울 때만 본문에.
 *  - 후보 0이면 달력 소멸 — 결정 제안(완화 4종)이 무대가 되고, 고르면 조건이 바뀌며 리빌.
 *  - 조건 수정 UI 없음 — 제안과 뒤로가기만 조건을 바꾼다. '한 번만' 규칙(decisionKey) 유지.
 *  - 겹침 타임라인(선택된 날의 팀 캘린더)은 PC 상시·모바일 접힘 — 추천을 바꾸면
 *    파란 카드가 그 빈틈으로 스프링 이동(엔진이 사정을 읽었다는 그림 증명).
 */

// ── 표시 상수 ──────────────────────────────────────────────────────

/** 겹침 타임라인의 종류색 — 홈 카드 색의 반투명 버전(겹침이 자연스럽게 섞이는 톤). */
const OVERLAY_STYLE: Record<EventKind, { bg: string; text: string }> = {
  meeting: { bg: 'rgba(0,153,255,.13)', text: '#0080E6' },
  focus: { bg: 'rgba(18,161,80,.13)', text: '#12A150' },
  lunch: { bg: 'rgba(255,149,0,.15)', text: '#E08300' },
  offsite: { bg: 'rgba(240,68,82,.11)', text: '#E23C4E' },
  personal: { bg: 'rgba(124,77,255,.11)', text: '#7C4DFF' },
};

const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** '수 15일' — 카드·CTA의 짧은 날짜 표기. */
function fmtDayShort(iso: string): string {
  return `${WEEKDAY_SHORT[weekdayIndex(iso)]} ${Number(iso.slice(8, 10))}일`;
}

// ── 표시 셀렉션(순수) ──────────────────────────────────────────────

/**
 * 추천 상위 고르기 — Q6·Q7: 4개 이하면 전부, 그 이상이면 상위 3개(같은 날 최대 2).
 * 엔진 순위는 불변 — 표시 레벨의 날짜 다양성 보정만 한다.
 */
export function pickRecommended(list: CandidateSlot[]): CandidateSlot[] {
  if (list.length <= 4) return list;
  const out: CandidateSlot[] = [];
  const perDay = new Map<string, number>();
  for (const s of list) {
    const count = perDay.get(s.day) ?? 0;
    if (count >= 2) continue;
    out.push(s);
    perDay.set(s.day, count + 1);
    if (out.length === 3) break;
  }
  return out;
}

/** 카드 서브라인 — 차이 나는 사정 한 줄(없으면 positive 요약). */
function cardReason(slot: CandidateSlot): string {
  const nonPositive = slot.reasons.find((r) => r.tone !== 'positive');
  return (nonPositive ?? slot.reasons[0])?.text ?? '';
}

// ── 조각들 ─────────────────────────────────────────────────────────

/** 주 스트립 달력 — 기한 창의 주만(1~3줄). 되는 날만 살아 있고, 선택된 날은 솔리드. */
function WeekStrip({
  windowDays,
  dayTone,
  selectedDay,
  onPick,
}: {
  windowDays: string[];
  /** 후보 있는 날 → 톤(ok=파랑/warn=주황). 없는 날은 흐림·비활성. */
  dayTone: Map<string, 'ok' | 'warn'>;
  selectedDay: string | null;
  onPick: (day: string) => void;
}) {
  const mondays = weekMondays(windowDays);
  const inWindow = new Set(windowDays);
  return (
    <div className="grid grid-cols-[44px_repeat(5,1fr)] gap-y-2">
      <span aria-hidden />
      {WEEKDAY_SHORT.slice(0, 5).map((w) => (
        <span key={w} className="pb-0.5 text-center text-[12px] text-text-faint">
          {w}
        </span>
      ))}
      {mondays.map((monday, wi) => (
        <Fragment key={monday}>
          <span className="flex items-center text-[11px] font-medium text-text-faint">{weekLabel(wi)}</span>
          {[0, 1, 2, 3, 4].map((i) => {
            const day = addDaysISO(monday, i);
            const tone = dayTone.get(day);
            const selected = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                disabled={!tone}
                aria-pressed={selected}
                aria-label={`${fmtDayKorean(day)}${tone ? '' : ' — 후보 없음'}`}
                onClick={() => onPick(day)}
                className={`pressable relative mx-auto flex h-11 w-11 items-center justify-center rounded-[14px] text-[15px] font-semibold ${
                  selected
                    ? 'bg-primary text-white shadow-[0_2px_10px_rgba(49,130,246,0.35)]'
                    : tone === 'ok'
                      ? 'bg-primary-tint font-bold text-primary-pressed'
                      : tone === 'warn'
                        ? 'bg-warn-bg font-bold text-warn-fg'
                        : inWindow.has(day)
                          ? 'text-text-faint'
                          : 'text-border'
                }`}
              >
                {Number(day.slice(8, 10))}
                {tone && !selected && (
                  <span
                    aria-hidden
                    className={`absolute bottom-[5px] h-1 w-1 rounded-full ${tone === 'ok' ? 'bg-primary' : 'bg-warn-fg'}`}
                  />
                )}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** 참석자 한 줄 — 체크 아바타(✓=필수), 탭하면 보기 전용 펼침. 조건 변경은 여기서 못 한다. */
function AttendeeLine({ attendees }: { attendees: Attendee[] }) {
  const [open, setOpen] = useState(false);
  const MAX = 7;
  const shown = attendees.slice(0, MAX);
  const extra = attendees.length - shown.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-1 text-left"
      >
        <span className="text-[14px] font-semibold text-text-strong">
          참석자 <span className="text-primary">{attendees.length}명</span>
        </span>
        <span className="flex pl-1">
          {shown.map((a) => (
            <span key={a.id} className="relative -ml-1.5 first:ml-0">
              <span className="block rounded-full ring-2 ring-white">
                <Avatar person={a} size={28} />
              </span>
              {a.attendanceType === 'required' && (
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#12A150] text-[7px] font-black text-white ring-2 ring-white"
                >
                  ✓
                </span>
              )}
            </span>
          ))}
          {extra > 0 && (
            <span className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-section text-[11px] font-semibold text-text-weak ring-2 ring-white">
              +{extra}
            </span>
          )}
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={`ml-auto shrink-0 text-text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-1.5">
          {attendees.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 py-1.5">
              <Avatar person={a} size={24} />
              <span className="text-[14px] font-medium text-text-strong">{a.name}</span>
              {a.isOrganizer && <span className="text-[11px] text-text-weak">나 · 주최자</span>}
              <span
                className={`ml-auto text-[12px] font-semibold ${
                  a.attendanceType === 'required' ? 'text-primary' : 'text-text-faint'
                }`}
              >
                {a.attendanceType === 'required' ? '꼭 참석' : '선택'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 후보 행 — 시간 굵게 + 차이 나는 사정 한 줄 + 배지. */
function SlotRow({
  slot,
  selected,
  badge,
  onSelect,
}: {
  slot: CandidateSlot;
  selected: boolean;
  badge?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
        selected ? 'bg-primary-tint shadow-[inset_0_0_0_1.5px_#9CC5FB]' : 'bg-[#F7F8FA] hover:bg-section'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[15px] font-bold tracking-[-0.01em] ${
            selected ? 'text-primary-pressed' : 'text-text-strong'
          }`}
        >
          {fmtDayShort(slot.day)} {fmtTime(slot.start)}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-[1.5] text-text-weak">{cardReason(slot)}</span>
      </span>
      {badge}
    </button>
  );
}

const BADGE_REC = (
  <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-primary shadow-[0_1px_4px_rgba(25,31,40,0.08)]">
    추천
  </span>
);
const BADGE_PARTIAL = (
  <span className="shrink-0 rounded-lg bg-[#F1ECFE] px-2 py-1 text-[11px] font-bold text-[#7C4DFF]">부분</span>
);
const BADGE_WARN = (
  <span className="shrink-0 rounded-lg bg-warn-bg px-2 py-1 text-[11px] font-bold text-warn-fg">아쉬움</span>
);

function badgeOf(slot: CandidateSlot, recommended: boolean): ReactNode {
  if (slot.severity === 'warning') return BADGE_WARN;
  if (slot.partials.length > 0) return BADGE_PARTIAL;
  if (recommended) return BADGE_REC;
  return undefined;
}

/** 완화 제안 행들 — 결정 모먼트의 손. 고르면 조건이 바뀌며 화면이 리빌된다. */
function SuggestionRows({
  suggestions,
  onPick,
}: {
  suggestions: RelaxationSuggestion[];
  onPick: (s: RelaxationSuggestion) => void;
}) {
  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <button
          key={`${s.kind}:${s.targetId ?? ''}`}
          type="button"
          onClick={() => onPick(s)}
          className="pressable flex w-full items-center gap-3 rounded-2xl bg-[#F7F8FA] px-4 py-3.5 text-left hover:bg-section"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold leading-[1.4] text-text-strong">{s.label}</span>
            <span className="mt-0.5 block text-[12px] leading-[1.4] text-text-weak">{s.resultSummary}</span>
          </span>
          <ChevronRight size={16} aria-hidden className="shrink-0 text-text-faint" />
        </button>
      ))}
    </div>
  );
}

// ── 겹침 타임라인 ──────────────────────────────────────────────────

interface TimelineItem {
  key: string;
  start: number;
  end: number;
  title: string;
  kind: EventKind;
  owner: string | null;
}

/** 그날 팀의 일정 — 점심은 겹침 사슬로 병합('점심 · N명'), 나머지는 주인 이름을 단다. */
export function timelineItems(attendees: Attendee[], day: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  const lunches: { start: number; end: number; owner: string }[] = [];
  for (const a of attendees) {
    for (const e of a.events) {
      if (e.day !== day) continue;
      if (e.kind === 'lunch') lunches.push({ start: e.start, end: e.end, owner: a.name });
      else items.push({ key: `${a.id}-${e.id}`, start: e.start, end: e.end, title: e.title, kind: e.kind, owner: a.name });
    }
  }
  lunches.sort((x, y) => x.start - y.start || x.end - y.end);
  let cluster: typeof lunches = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length === 0) return;
    if (cluster.length === 1) {
      const l = cluster[0];
      items.push({ key: `lunch-${l.owner}-${l.start}`, start: l.start, end: l.end, title: '점심', kind: 'lunch', owner: l.owner });
    } else {
      const start = Math.min(...cluster.map((l) => l.start));
      const end = Math.max(...cluster.map((l) => l.end));
      items.push({ key: `lunch-merged-${start}`, start, end, title: `점심 · ${cluster.length}명`, kind: 'lunch', owner: null });
    }
    cluster = [];
  };
  for (const l of lunches) {
    if (cluster.length === 0 || l.start < clusterEnd) {
      cluster.push(l);
      clusterEnd = Math.max(clusterEnd, l.end);
    } else {
      flush();
      cluster.push(l);
      clusterEnd = l.end;
    }
  }
  flush();
  return items.sort((x, y) => x.start - y.start || x.end - y.end || x.key.localeCompare(y.key));
}

/** 겹침 레인 배정 — 겹치면 반 칸씩 옆으로(토스플레이스 문법). 결정적. */
export function withLanes(items: TimelineItem[]): (TimelineItem & { lane: number })[] {
  const laneEnds: number[] = [];
  return items.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    return { ...item, lane: Math.min(lane, 3) };
  });
}

const TL_START = 540; // 9:00
const TL_END = 1080; // 18:00
const TL_PX_PER_MIN = 0.72;

function OverlapTimeline({
  attendees,
  day,
  slot,
  reduced,
}: {
  attendees: Attendee[];
  day: string;
  slot: CandidateSlot | null;
  reduced: boolean;
}) {
  const items = useMemo(() => withLanes(timelineItems(attendees, day)), [attendees, day]);
  const y = (minute: number) => (Math.min(Math.max(minute, TL_START), TL_END) - TL_START) * TL_PX_PER_MIN;

  return (
    <div className="relative" style={{ height: (TL_END - TL_START) * TL_PX_PER_MIN }}>
      {/* 시간선 — 홈 캘린더와 같은 헤어라인 문법 */}
      {Array.from({ length: (TL_END - TL_START) / 60 + 1 }, (_, i) => TL_START + i * 60).map((h) => {
        const hour = h / 60;
        return (
          <div key={h} aria-hidden className="absolute inset-x-0 border-t border-border/40" style={{ top: y(h) }}>
            <span className="absolute -top-2 left-0 w-8 text-right text-[10px] leading-4 text-text-faint">
              {hour <= 12 ? `${hour}시` : `${hour - 12}시`}
            </span>
          </div>
        );
      })}
      <div className="absolute inset-y-0 left-11 right-0">
        {items.map((item) => {
          const c = OVERLAY_STYLE[item.kind];
          const h = Math.max(y(item.end) - y(item.start), 12);
          return (
            /* 텍스트 없이 색으로만 — 겹침은 분위기로 읽힌다. 궁금하면 호버(툴팁). */
            <div
              key={item.key}
              className="group absolute rounded-[8px]"
              style={{ top: y(item.start), height: h, left: `${item.lane * 15}%`, width: '32%', backgroundColor: c.bg }}
            >
              <span className="pointer-events-none absolute -top-7 left-1 z-20 hidden whitespace-nowrap rounded-lg bg-[#333D4B] px-2 py-1 text-[11px] font-medium text-white shadow-[0_4px_12px_rgba(25,31,40,0.25)] group-hover:block">
                {item.title}
                {item.owner ? ` · ${item.owner}` : ''}
              </span>
            </div>
          );
        })}
        {/* 선택된 추천 — 빈틈에 앉은 솔리드 블루. 선택이 바뀌면 스프링으로 이동한다. */}
        {slot && (
          <motion.div
            initial={false}
            animate={{ top: y(slot.start), height: Math.max(y(slot.end) - y(slot.start), 20) }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
            className="absolute left-0 right-[24%] z-10 rounded-[10px] bg-primary px-2.5 py-1.5 text-white shadow-[0_4px_14px_rgba(49,130,246,0.35)]"
          >
            <p className="text-[11px] font-bold leading-[1.3]">
              {fmtTime(slot.start)} – {fmtTime(slot.end)}
            </p>
            <p className="text-[9.5px] font-medium leading-[1.3] opacity-85">여기로 잡을게요</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── 본체 ───────────────────────────────────────────────────────────

export interface FindTimeProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  candidates: Candidates;
}

export default function FindTime({ state, dispatch, candidates }: FindTimeProps) {
  const reduced = !!useReducedMotion();
  const { attendees, windowDays, slots, suggestions, bottleneck } = candidates;

  const requiredCount = attendees.filter((a) => a.attendanceType === 'required').length;
  const optionalCount = attendees.length - requiredCount;

  // ── 표시 셀렉션 — Q2·Q6·Q7 ──
  const goodish = useMemo(() => slots.filter((s) => s.severity !== 'warning'), [slots]);
  const warnings = useMemo(() => slots.filter((s) => s.severity === 'warning'), [slots]);
  const empty = slots.length === 0; // 상태 C
  const allWarning = !empty && goodish.length === 0; // 상태 B
  const recommended = useMemo(() => pickRecommended(goodish), [goodish]);
  const baseList = allWarning ? warnings.slice(0, 3) : recommended;

  // 달력 — 후보 있는 날의 톤(좋음이 아쉬움을 덮는다)
  const dayTone = useMemo(() => {
    const m = new Map<string, 'ok' | 'warn'>();
    if (allWarning) for (const s of warnings) m.set(s.day, 'warn');
    else for (const s of goodish) m.set(s.day, 'ok'); // 클릭 안 되는 날은 표시도 없다
    return m;
  }, [goodish, warnings, allWarning]);

  // ── 선택 — 1위가 미리 골라져 있다(백지 선택 금지) ──
  const [selectedId, setSelectedId] = useState<string | null>(state.selectedSlotId);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const listShown = useMemo(() => {
    if (!dayFilter) return baseList;
    return (allWarning ? warnings : goodish).filter((s) => s.day === dayFilter).slice(0, 4);
  }, [dayFilter, baseList, goodish, warnings, allWarning]);
  const active = useMemo(
    () => slots.find((s) => s.id === selectedId) ?? listShown[0] ?? baseList[0] ?? null,
    [slots, selectedId, listShown, baseList],
  );

  const select = (slot: CandidateSlot) => {
    setSelectedId(slot.id);
    dispatch({ type: 'SELECT_SLOT', slotId: slot.id });
  };

  const pickDay = (day: string) => {
    if (dayFilter === day) {
      setDayFilter(null);
      return;
    }
    const pool = (allWarning ? warnings : goodish).filter((s) => s.day === day);
    if (pool.length === 0) return;
    setDayFilter(day);
    select(pool[0]);
  };

  // ── '한 번만' 규칙 — 같은 조건 조합의 제안엔 1회만 ──
  const condKey = decisionKey(state);
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const showSuggestions = suggestions.length > 0 && (empty || condKey !== answeredKey);
  const pickSuggestion = (s: RelaxationSuggestion) => {
    setAnsweredKey(condKey);
    setDayFilter(null);
    const action = pickAction(s, state.deadline);
    if (action) dispatch(action);
  };

  // ── 더 보기 ──
  const [moreOpen, setMoreOpen] = useState(false);
  const restByDay = useMemo(() => {
    const rest = goodish.filter((s) => !recommended.some((r) => r.id === s.id));
    const byDay = new Map<string, CandidateSlot[]>();
    for (const s of rest) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()];
  }, [goodish, recommended]);
  // 아쉬운 후보는 전부-아쉬움 상태에서만 센다 — 좋은 답이 있으면 더 보기도 좋은 시간만(단순함).
  const moreCount = allWarning
    ? Math.max(warnings.length - baseList.length, 0)
    : goodish.length - recommended.length;

  // ── 헤드라인 — 상태 선언 ──
  const partialTarget = state.allowPartialRequiredId
    ? (attendees.find((a) => a.id === state.allowPartialRequiredId) ?? null)
    : null;
  const loose = goodish.length >= 15;
  const countsLine = `${DEADLINE_LABEL[state.deadline]} · 필수 ${requiredCount}명${
    optionalCount > 0 ? ` · 선택 ${optionalCount}명` : ''
  } · 후보 ${allWarning ? warnings.length : goodish.length}개`;

  let headline: string;
  let sub: string;
  if (empty) {
    headline = `${WINDOW_LABEL[state.deadline]}까지는\n모두가 편한 시간이 없어요`;
    sub = bottleneck
      ? `${bottleneck.name}님의 ${bottleneck.eventTitle}${josa(bottleneck.eventTitle, '이', '가')} 겹쳐요. 어떻게 할까요?`
      : '조건을 조금 바꿔볼까요?';
  } else if (allWarning) {
    headline = '가능한 시간이 다 조금 아쉬워요';
    sub = bottleneck
      ? `${bottleneck.name}님의 ${bottleneck.eventTitle}${josa(bottleneck.eventTitle, '이', '가')} 겹쳐요`
      : countsLine;
  } else if (partialTarget) {
    headline = `${partialTarget.name}님이 일부만 함께하면 돼요`;
    sub = countsLine;
  } else if (goodish.length === 1) {
    headline = '이 시간뿐이에요';
    sub = countsLine;
  } else {
    headline = slots.some((s) => s.severity === 'good')
      ? `모두 가능한 ${DURATION_LABEL[state.duration]}이에요`
      : '다들 가능한데, 조금씩 사정이 있어요';
    sub = loose ? '거의 언제든 괜찮아요 — 편한 날을 골라보세요' : countsLine;
  }

  // ── 확정 ──
  const confirm = () => {
    if (!active) return;
    dispatch({ type: 'SELECT_SLOT', slotId: active.id });
    dispatch({ type: 'SET_STEP', step: 'confirm' });
  };
  const cta = active && (
    <button
      type="button"
      onClick={confirm}
      className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white active:bg-primary-pressed"
    >
      {fmtDayShort(active.day)} {fmtTime(active.start)}로 할게요
    </button>
  );

  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg pb-32 lg:pb-12">
      {/* 데스크톱 헤더 — 셋업·홈과 같은 오로라·워드마크 틀 */}
      <div className="relative hidden lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Aurora variant="home" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </div>
        <div className="relative mx-auto max-w-[1200px] px-6 py-4">
          <header className="flex h-10 items-center">
            <Wordmark />
          </header>
        </div>
      </div>

      {/* 뒤로가기 줄 — 조건을 바꾸고 싶으면 뒤로(셋업). 조건 수정 UI는 여기 없다. */}
      <FrostedBar innerClassName="mx-auto max-w-[520px] px-4 lg:max-w-[1200px] lg:px-6">
        <Reveal as="header" className="-mx-1 flex h-14 items-center lg:mx-0">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'setup' })}
            aria-label="뒤로"
            className="pressable -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-text-strong hover:bg-section"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        </Reveal>
      </FrostedBar>

      <div className="mx-auto max-w-[520px] px-4 lg:max-w-[1200px] lg:px-6 lg:pt-2">
        <div className="lg:mx-auto lg:max-w-[920px] lg:px-4">
          <Reveal delay={70} className="pt-3 lg:pt-0">
            <h1 className="whitespace-pre-line text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong">
              {headline}
            </h1>
            <p className="mt-1.5 break-keep text-[13px] leading-[1.5] text-text-weak">{sub}</p>
          </Reveal>

          {empty ? (
            /* ── 상태 C — 달력 소멸, 결정 제안이 무대 ── */
            <div className="lg:max-w-[480px]">
              <Reveal delay={160} className="pt-7">
                {showSuggestions ? (
                  <SuggestionRows suggestions={suggestions} onPick={pickSuggestion} />
                ) : (
                  <p className="rounded-2xl bg-[#F7F8FA] px-4 py-3.5 text-[13px] leading-[1.6] text-text-weak">
                    뒤로 가서 참석자나 회의 길이를 바꿔 주시면 바로 다시 찾아볼게요.
                  </p>
                )}
              </Reveal>
              <Reveal delay={240} className="pt-8">
                <AttendeeLine attendees={attendees} />
              </Reveal>
            </div>
          ) : (
            /* ── 상태 A·B·D — 좌 달력·참석자 / 우 추천·타임라인·CTA ── */
            <div className="lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-[auto_1fr] lg:gap-x-14">
              <Reveal delay={140} className="pt-6 lg:col-start-1 lg:row-start-1">
                <WeekStrip
                  windowDays={windowDays}
                  dayTone={dayTone}
                  selectedDay={active?.day ?? null}
                  onPick={pickDay}
                />
                <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[12px] text-text-weak lg:justify-start lg:pl-[44px]">
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${allWarning ? 'bg-warn-fg' : 'bg-primary'}`} />
                  {allWarning ? '아쉬운 대로 가능한 날이에요' : '추천이 있는 날이에요 — 눌러서 둘러보세요'}
                </p>
              </Reveal>

              <Reveal delay={210} className="pt-7 lg:col-start-1 lg:row-start-2">
                <AttendeeLine attendees={attendees} />
              </Reveal>

              <Reveal delay={280} className="pt-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6">
                <p className="text-[14px] font-semibold text-text-strong">
                  {dayFilter ? `${fmtDayKorean(dayFilter)}의 시간` : allWarning ? '그나마 나은 순이에요' : '추천 순이에요'}
                </p>
                <div className="mt-2.5 space-y-2">
                  {listShown.map((slot, i) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      selected={active?.id === slot.id}
                      badge={badgeOf(slot, !dayFilter && !allWarning && i === 0)}
                      onSelect={() => select(slot)}
                    />
                  ))}
                </div>

                {dayFilter ? (
                  <button
                    type="button"
                    onClick={() => setDayFilter(null)}
                    className="pressable mt-2.5 w-full rounded-xl py-2 text-center text-[13px] font-medium text-text-weak hover:bg-section/60"
                  >
                    전체 추천으로 돌아가기
                  </button>
                ) : (
                  moreCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setMoreOpen((o) => !o)}
                      aria-expanded={moreOpen}
                      className="pressable mt-2.5 w-full rounded-xl py-2 text-center text-[13px] font-medium text-text-weak hover:bg-section/60"
                    >
                      {moreOpen ? '접기' : `다른 시간 ${moreCount}개 더 보기`}
                    </button>
                  )
                )}

                {/* 더 보기 — 날짜 그룹 + 시간 칩, 아쉬운 시간은 맨 아래(이유 동반) */}
                {moreOpen && !dayFilter && (
                  <div className="mt-2 space-y-4 rounded-2xl bg-[#F9FAFB] p-4">
                    {!allWarning &&
                      restByDay.map(([day, arr]) => (
                        <div key={day}>
                          <p className="text-[12px] font-semibold text-text-weak">{fmtDayKorean(day)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {arr.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                aria-pressed={active?.id === s.id}
                                onClick={() => select(s)}
                                className={`pressable rounded-xl px-3 py-2 text-[13px] font-semibold ${
                                  active?.id === s.id
                                    ? 'bg-primary text-white'
                                    : 'bg-white text-text-body shadow-[0_1px_3px_rgba(25,31,40,0.06)] hover:bg-section'
                                }`}
                              >
                                {fmtTime(s.start)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    {allWarning && warnings.slice(3, 7).length > 0 && (
                      <div className="space-y-1.5">
                        {warnings.slice(3, 7).map((slot) => (
                          <SlotRow
                            key={slot.id}
                            slot={slot}
                            selected={active?.id === slot.id}
                            badge={BADGE_WARN}
                            onSelect={() => select(slot)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 전부 아쉬울 때만 — 완화 제안이 본문에 함께 선다(상태 B) */}
                {allWarning && showSuggestions && (
                  <div className="mt-5">
                    <p className="text-[14px] font-semibold text-text-strong">이렇게 풀 수도 있어요</p>
                    <div className="mt-2.5">
                      <SuggestionRows suggestions={suggestions} onPick={pickSuggestion} />
                    </div>
                  </div>
                )}

                {/* 그날의 팀 캘린더 — PC 상시, 모바일은 접힘(Q8) */}
                {active && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => setTimelineOpen((o) => !o)}
                      aria-expanded={timelineOpen}
                      className="pressable flex w-full items-center justify-between rounded-xl py-2 text-[13px] font-medium text-text-weak lg:hidden"
                    >
                      {fmtDayKorean(active.day)} 모두의 일정 {timelineOpen ? '접기' : '보기'}
                      <ChevronDown
                        size={14}
                        aria-hidden
                        className={`transition-transform duration-200 ${timelineOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div
                      className={`${timelineOpen ? 'block' : 'hidden'} rounded-2xl bg-[#F9FAFB] p-4 pt-3 lg:block`}
                    >
                      <p className="hidden pb-2 text-[12px] font-semibold text-text-weak lg:block">
                        {fmtDayKorean(active.day)} 모두의 일정
                      </p>
                      <OverlapTimeline attendees={attendees} day={active.day} slot={active} reduced={reduced} />
                    </div>
                  </div>
                )}

                <div className="hidden pt-6 lg:block">{cta}</div>
              </Reveal>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 고정 CTA — 셋업과 같은 하단 frost */}
      {!empty && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 px-4 pt-6 lg:hidden"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent"
          />
          <div className="relative mx-auto max-w-[520px]">{cta}</div>
        </div>
      )}
    </div>
  );
}
