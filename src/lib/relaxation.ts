import type { Attendee, CandidateSlot, DeadlineKind, PersonInsights, Room, Rules } from './types';
import { rankSlots } from './scheduler';
import { fmtDayKorean, fmtTime, isBusinessDay } from './time';
import { HARD_BLOCK_KINDS } from './partial';
import { ANCHOR_DATE, windowFor } from './window';

/**
 * 완화 시뮬 하네스(엔진 6단계). 후보가 0개거나 전부 warning일 때, 구체적 탈출구를 "실제로 시뮬레이션"해
 * 슬롯을 여는 것만, 정직한 숫자로 제안한다. v1 patch→rank→best 골격 이식 + 결함 수정:
 *  ② 모든 시뮬이 메인과 같은 rooms를 통과시킨다 — 방 없는 시간을 "열렸다"고 말하지 않는다.
 *  ④ extend-deadline의 label·resultSummary가 patch가 만든 창과 정확히 일치한다.
 *  ⑦ make-optional·allow-partial·findBottleneck 모두 주최자를 대상으로 삼지 않는다.
 */
export type RelaxationKind = 'extend-deadline' | 'shorten-meeting' | 'make-optional' | 'allow-partial-required';

export interface RelaxationSuggestion {
  kind: RelaxationKind;
  targetId?: string;
  label: string;
  resultSummary: string;
  opens: number;
  bestSlot: CandidateSlot | null;
}

interface EngineArgs {
  attendees: Attendee[];
  rules: Rules;
  rooms: Room[];
  insights: Record<string, PersonInsights>;
}

/**
 * 기한 완화는 한 단계만 미룬다(this-week→next-week→flexible). flexible은 더 미룰 곳이 없다.
 * export — DecisionMoment.pickAction이 같은 사다리를 써야 시뮬이 돌린 patch와 dispatch가 일치한다.
 */
export const NEXT_DEADLINE: Record<DeadlineKind, 'next-week' | 'flexible' | null> = {
  'this-week': 'next-week',
  'next-week': 'flexible',
  flexible: null,
};

const EXTEND_LABEL: Record<'next-week' | 'flexible', string> = {
  'next-week': '기한을 다음 주까지로 미뤄요',
  flexible: '기한을 그 다음 주까지로 미뤄요',
};

interface Candidate {
  kind: RelaxationKind;
  targetId?: string;
  label: string;
  run: () => CandidateSlot[];
}

/** 결정 7: '{요일} {시각}이 열려요 · 후보 {N}개' — fmtDayKorean/fmtTime of bestSlot. */
function summarize(bestSlot: CandidateSlot, opens: number): string {
  return `${fmtDayKorean(bestSlot.day)} ${fmtTime(bestSlot.start)}이 열려요 · 후보 ${opens}개`;
}

export function suggestRelaxations(args: EngineArgs): RelaxationSuggestion[] {
  const { attendees, rules, rooms, insights } = args;
  const candidates: Candidate[] = [];

  // 1) extend-deadline — 라벨과 patch가 같은 창을 가리킨다(결함④): 창은 windowFor(nextDeadline)로 만든다.
  const nextDeadline = NEXT_DEADLINE[rules.deadline];
  if (nextDeadline) {
    const days = windowFor(nextDeadline, ANCHOR_DATE);
    candidates.push({
      kind: 'extend-deadline',
      label: EXTEND_LABEL[nextDeadline],
      run: () => rankSlots({ attendees, rules: { ...rules, deadline: nextDeadline, days }, rooms, insights }),
    });
  }

  // 2) shorten-meeting — 60→30. 이미 30이면 스킵.
  if (rules.durationMinutes === 60) {
    candidates.push({
      kind: 'shorten-meeting',
      label: '30분 회의로 줄여요',
      run: () => rankSlots({ attendees, rules: { ...rules, durationMinutes: 30 }, rooms, insights }),
    });
  }

  // 3) 필수 비주최자(결함⑦)를 한 명씩: make-optional / allow-partial-required.
  const targets = attendees.filter((a) => a.attendanceType === 'required' && !a.isOrganizer);
  for (const t of targets) {
    candidates.push({
      kind: 'make-optional',
      targetId: t.id,
      label: `${t.name}님을 선택 참석으로 바꿔요`,
      run: () =>
        rankSlots({
          attendees: attendees.map((a) => (a.id === t.id ? { ...a, attendanceType: 'optional' as const } : a)),
          rules,
          rooms,
          insights,
        }),
    });
    candidates.push({
      kind: 'allow-partial-required',
      targetId: t.id,
      label: `${t.name}님이 일부만 함께해도 괜찮다면`,
      // 대상은 필수 그대로 — partialAvailability 통과를 하드필터 예외로만 허용한다(결정 3).
      run: () => rankSlots({ attendees, rules, rooms, insights }, { allowPartialFor: t.id }),
    });
  }

  // 실제 시뮬레이션 → opens(살아남은 슬롯 수) 내림차순, 열리는 것만. 동점은 더 좋은 bestSlot 우선(결정론).
  const evaluated = candidates
    .map((c) => {
      const slots = c.run();
      return { c, opens: slots.length, bestSlot: slots[0] ?? null };
    })
    .filter((e): e is { c: Candidate; opens: number; bestSlot: CandidateSlot } => e.opens > 0 && e.bestSlot !== null);

  evaluated.sort((a, b) => b.opens - a.opens || b.bestSlot.score - a.bestSlot.score);

  return evaluated.slice(0, 3).map(({ c, opens, bestSlot }) => ({
    kind: c.kind,
    targetId: c.targetId,
    label: c.label,
    resultSummary: summarize(bestSlot, opens),
    opens,
    bestSlot,
  }));
}

/**
 * 결정 8: 필수 비주최자를 한 명씩 빼서 재랭킹 — 후보가 현재보다 가장 많이 늘어나는 사람이 병목.
 * 그 사람이 창(rules.days 영업일) 안에서 처음 부딪히는 하드 블로킹 일정을 원인으로 지목한다.
 * 늘어나는 사람이 없거나(주최자만 병목이면 여기서 걸러진다) 지목할 일정이 없으면 null.
 */
export function findBottleneck(args: EngineArgs): { personId: string; eventTitle: string } | null {
  const { attendees, rules, rooms, insights } = args;
  const baseline = rankSlots({ attendees, rules, rooms, insights }).length;
  const targets = attendees.filter((a) => a.attendanceType === 'required' && !a.isOrganizer);

  let best: { person: Attendee; opens: number } | null = null;
  for (const t of targets) {
    const opens = rankSlots({ attendees: attendees.filter((a) => a.id !== t.id), rules, rooms, insights }).length;
    if (opens > baseline && (best === null || opens > best.opens)) {
      best = { person: t, opens };
    }
  }
  if (best === null) return null;

  const title = firstConflictTitle(best.person, rules);
  return title === null ? null : { personId: best.person.id, eventTitle: title };
}

/** 병목 인물이 창(rules.days 영업일) 안에서 처음(날짜→시작순) 부딪히는 하드 블로킹 일정 제목. 없으면 null. */
function firstConflictTitle(person: Attendee, rules: Rules): string | null {
  const days = new Set(rules.days.filter(isBusinessDay));
  const conflicts = person.events
    .filter((e) => days.has(e.day) && HARD_BLOCK_KINDS.has(e.kind))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.start - b.start));
  return conflicts[0]?.title ?? null;
}
