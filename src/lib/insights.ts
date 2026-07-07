/**
 * 패턴 추출기 — "캘린더가 사람을 읽는다"의 단일 소스. 순수·결정론적.
 *
 * 한 번의 추출(deriveInsights)이 세 소비자를 먹인다:
 *  1) headline — 프로필 피크의 각주 문장(피크 모먼트)
 *  2) scanLine — 스캔 모먼트의 한 줄(항상 존재)
 *  3) lunchRhythm — 스코어링 엔진이 읽는 점심 리듬(scoring: insights[id]?.lunchRhythm)
 * 세 값이 같은 추출 결과에서 파생되므로 피크·스캔·이유 칩이 서로 모순되지 않는다(일관성 계약).
 *
 * 창(windowDays) 안의 이벤트만 분석한다 — 조율 대상 기간의 패턴만 읽는다.
 */
import type { Minutes } from './time';
import { weekdayIndex, fmtTime } from './time';
import { josa } from './reasons';
import type { CalendarEvent, LunchRhythm, Person, PersonInsights } from './types';

/** 요일 라벨(0=월..4=금). weekdayIndex와 정렬 — 주말은 패턴 대상이 아니다. */
const DAY_LABELS = ['월', '화', '수', '목', '금'] as const;
/** 폴백 종일급 외근 기준(분). 4시간 이상이면 "그날은 외근"으로 본다. */
const FULL_DAY_OFFSITE = 240;

/** 창 안 이벤트만 남긴다. */
function inWindow(events: CalendarEvent[], windowDays: string[]): CalendarEvent[] {
  const set = new Set(windowDays);
  return events.filter((e) => set.has(e.day));
}

/**
 * 외근 요일: kind==='offsite'가 같은 요일 2개↑ distinct day에서 발생하면 포함(주요 규칙).
 * 폴백: 창에 그 요일 인스턴스가 1개뿐이면(짧은 창) 종일급 외근(≥240분) 1회로도 포함.
 * 라벨이 있는 평일(0=월..4=금)만 대상.
 */
function extractOffsiteWeekdays(events: CalendarEvent[], windowDays: string[]): number[] {
  const offsites = events.filter((e) => e.kind === 'offsite');
  // 요일별 창 인스턴스 수(며칠이 그 요일인가).
  const windowInstances = new Map<number, number>();
  for (const day of windowDays) {
    const w = weekdayIndex(day);
    windowInstances.set(w, (windowInstances.get(w) ?? 0) + 1);
  }
  // 요일별 외근이 발생한 distinct day, 그리고 종일급 여부.
  const offsiteDays = new Map<number, Set<string>>();
  const hasFullDay = new Map<number, boolean>();
  for (const e of offsites) {
    const w = weekdayIndex(e.day);
    if (w > 4) continue; // 주말 외근은 패턴 아님
    if (!offsiteDays.has(w)) offsiteDays.set(w, new Set());
    offsiteDays.get(w)!.add(e.day);
    if (e.end - e.start >= FULL_DAY_OFFSITE) hasFullDay.set(w, true);
  }

  const result: number[] = [];
  for (const [w, days] of offsiteDays) {
    if (days.size >= 2) {
      result.push(w);
    } else if ((windowInstances.get(w) ?? 0) === 1 && hasFullDay.get(w)) {
      result.push(w); // 폴백: 요일 1회 인스턴스 + 종일급 외근
    }
  }
  return result.sort((a, b) => a - b);
}

/**
 * 반복 일정: 같은 요일+시각 meeting이 2개↑ distinct day면 {weekday,start,title}.
 * title은 최초(가장 이른 날) 발생 기준. weekday→start 순 정렬.
 */
function extractRecurring(events: CalendarEvent[]): PersonInsights['recurring'] {
  const meetings = events.filter((e) => e.kind === 'meeting');
  // key = `${weekday}|${start}` → { days, title(최초) }
  const groups = new Map<string, { weekday: number; start: Minutes; days: Set<string>; title: string; firstDay: string }>();
  for (const e of meetings) {
    const weekday = weekdayIndex(e.day);
    const key = `${weekday}|${e.start}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { weekday, start: e.start, days: new Set([e.day]), title: e.title, firstDay: e.day });
    } else {
      g.days.add(e.day);
      if (e.day < g.firstDay) { g.firstDay = e.day; g.title = e.title; }
    }
  }

  const result = [...groups.values()]
    .filter((g) => g.days.size >= 2)
    .map((g) => ({ weekday: g.weekday, start: g.start, title: g.title }));
  result.sort((a, b) => (a.weekday !== b.weekday ? a.weekday - b.weekday : a.start - b.start));
  return result;
}

/**
 * 점심 리듬: kind==='lunch'의 최빈 (start,end) 쌍. 동률이면 더 이른 start(그다음 end).
 * 없으면 null — 예측하지 않는다.
 */
function extractLunchRhythm(events: CalendarEvent[]): LunchRhythm | null {
  const lunches = events.filter((e) => e.kind === 'lunch');
  if (lunches.length === 0) return null;

  const counts = new Map<string, { start: Minutes; end: Minutes; count: number }>();
  for (const e of lunches) {
    const key = `${e.start}|${e.end}`;
    const c = counts.get(key);
    if (c) c.count += 1;
    else counts.set(key, { start: e.start, end: e.end, count: 1 });
  }

  let best: { start: Minutes; end: Minutes; count: number } | null = null;
  for (const c of counts.values()) {
    if (
      best === null ||
      c.count > best.count ||
      (c.count === best.count && c.start < best.start) ||
      (c.count === best.count && c.start === best.start && c.end < best.end)
    ) {
      best = c;
    }
  }
  return best ? { start: best.start, end: best.end } : null;
}

/** 피크 각주 문장(감정어 금지). 우선순위: 외근 > 반복 > 점심. 없으면 null. */
function buildHeadline(
  offsiteWeekdays: number[],
  recurring: PersonInsights['recurring'],
  lunchRhythm: LunchRhythm | null,
): string | null {
  if (offsiteWeekdays.length > 0) {
    return `${DAY_LABELS[offsiteWeekdays[0]]}요일은 외근이 잦은 편이에요`;
  }
  if (recurring.length > 0) {
    const r = recurring[0];
    return `매주 ${DAY_LABELS[r.weekday]} ${fmtTime(r.start)} ${r.title}${josa(r.title, '이', '가')} 있어요`;
  }
  if (lunchRhythm) {
    return `보통 ${fmtTime(lunchRhythm.start)}쯤 점심을 먹어요`;
  }
  return null;
}

/** 스캔 모먼트 한 줄(항상 존재). 우선순위: 외근 > 반복 > 점심 > 폴백. */
function buildScanLine(
  name: string,
  offsiteWeekdays: number[],
  recurring: PersonInsights['recurring'],
  lunchRhythm: LunchRhythm | null,
): string {
  if (offsiteWeekdays.length > 0) return `${name}님의 외근 요일을 확인했어요`;
  if (recurring.length > 0) return `${name}님의 정기 일정을 기억했어요`;
  if (lunchRhythm) return `${name}님의 점심 리듬을 살폈어요`;
  return `${name}님의 일정을 확인했어요`;
}

/** 한 사람의 창 내 일정에서 패턴을 추출한다 — 세 소비자의 단일 소스. */
export function deriveInsights(person: Person, windowDays: string[]): PersonInsights {
  const events = inWindow(person.events, windowDays);
  const offsiteWeekdays = extractOffsiteWeekdays(events, windowDays);
  const recurring = extractRecurring(events);
  const lunchRhythm = extractLunchRhythm(events);
  return {
    offsiteWeekdays,
    recurring,
    lunchRhythm,
    headline: buildHeadline(offsiteWeekdays, recurring, lunchRhythm),
    scanLine: buildScanLine(person.name, offsiteWeekdays, recurring, lunchRhythm),
  };
}

/** 여러 사람 → id 키 맵. 스코어링이 insights[id]로 읽는다. */
export function deriveAllInsights(people: Person[], windowDays: string[]): Record<string, PersonInsights> {
  const out: Record<string, PersonInsights> = {};
  for (const p of people) out[p.id] = deriveInsights(p, windowDays);
  return out;
}
