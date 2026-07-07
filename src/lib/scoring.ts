import type { Minutes } from './time';
import { overlaps } from './time';
import type { Attendee, PartialInfo, PersonInsights, Room, ScoreEffect } from './types';
import { availableRooms } from './rooms';
import { afterLunchEffect, beforeLunchEffect, lunchSqueezeEffect } from './lunch';

/**
 * 순수 점수 규칙 상수. 한국어 문장은 여기 없다(reasons.ts 담당).
 * 계약: Task 4~6 전체가 이 표를 공유한다. optionalPartial·beforeLunch·afterLunch·lunchSqueeze는
 * Task 5·6에서 활성화되며, 이 태스크의 scoreSlot은 아직 해당 effect를 만들지 않는다.
 */
export const SCORING = {
  optionalOk: 10,
  optionalPartial: 5,
  beforeLunch: 4,
  afterLunch: -12,
  lunchSqueeze: -8,
  offsite: -8,
  backToBack: -6,
  focusOverlap: -5,
  lateStart: -4,
  noRoom: -7,
} as const;

const DEFAULT_FRAME = { start: 540, end: 1080 } as const; // 09:00–18:00
const BACK_TO_BACK_BUFFER = 15;
const LATE_START_TAIL = 30;

/** 필수 참석자에게 하드 블로킹되는 이벤트 종류. focus·lunch는 절대 블로킹하지 않는다. */
const HARD_BLOCK_KINDS = new Set<string>(['meeting', 'offsite', 'personal']);

/** 필수 참석자 근무시간의 교집합으로 후보 프레임을 만든다. 필수가 없으면 09:00–18:00. */
export function requiredFrame(attendees: Attendee[]): { start: Minutes; end: Minutes } {
  const required = attendees.filter((a) => a.attendanceType === 'required');
  if (required.length === 0) return { ...DEFAULT_FRAME };
  return {
    start: Math.max(...required.map((a) => a.workHours.start)),
    end: Math.min(...required.map((a) => a.workHours.end)),
  };
}

/** 참석자가 해당 슬롯에 하드 블로킹 일정(meeting·offsite·personal)과 겹치는지. */
export function hasBlockingConflict(
  attendee: Attendee,
  day: string,
  start: Minutes,
  end: Minutes,
): boolean {
  return attendee.events.some(
    (e) => e.day === day && HARD_BLOCK_KINDS.has(e.kind) && overlaps(start, end, e.start, e.end),
  );
}

/** 슬롯이 참석자 근무시간 밖인지. */
export function isOutsideWorkHours(attendee: Attendee, start: Minutes, end: Minutes): boolean {
  return start < attendee.workHours.start || end > attendee.workHours.end;
}

interface SlotContext {
  day: string;
  start: Minutes;
  end: Minutes;
  frame: { start: Minutes; end: Minutes };
  required: Attendee[];
  optional: Attendee[];
  availableOptional: Attendee[];
  participating: Attendee[]; // required + 참석 가능한 선택 = 실제로 오는 사람
  insights: Record<string, PersonInsights>;
}

/**
 * 선택 참석자 평가(현재: 이진). Task 6에서 부분 참석으로 교체하는 확장점 —
 * 여기 한 곳만 바꾸면 optional-partial·partials가 붙는다.
 */
function evaluateOptional(
  optional: Attendee[],
  day: string,
  start: Minutes,
  end: Minutes,
): { availableIds: Set<string>; effects: ScoreEffect[]; partials: PartialInfo[] } {
  const okIds: string[] = [];
  const effects: ScoreEffect[] = [];
  for (const a of optional) {
    const available = !hasBlockingConflict(a, day, start, end) && !isOutsideWorkHours(a, start, end);
    if (available) okIds.push(a.id);
  }
  if (okIds.length > 0) {
    // 결함① 정규화: 인원수로 평균 내어 한 effect·최대 +10. 대규모 선택 참석이 warning을 덮지 못한다.
    effects.push({
      code: 'optional-ok',
      delta: Math.round((SCORING.optionalOk * okIds.length) / optional.length),
      data: { ok: okIds.length, total: optional.length },
    });
  }
  const okSet = new Set(okIds);
  for (const a of optional) {
    if (!okSet.has(a.id)) effects.push({ code: 'optional-unavailable', delta: 0, who: a.id });
  }
  return { availableIds: okSet, effects, partials: [] };
}

/** back-to-back 인접 스캔 대상 종류. offsite는 offsite-day가, lunch/focus는 각자 규칙이 담당한다. */
const BACK_TO_BACK_KINDS = new Set<string>(['meeting', 'personal']);

/** 결함③: 직전·직후 15분 내 붙은 일정을 양방향·사람당 하나로 기록. meeting·personal만 대상. */
function backToBackEffects(ctx: SlotContext): ScoreEffect[] {
  const { day, start, end } = ctx;
  const effects: ScoreEffect[] = [];
  for (const a of ctx.participating) {
    for (const e of a.events) {
      if (e.day !== day) continue;
      if (!BACK_TO_BACK_KINDS.has(e.kind)) continue;
      // 직전: 슬롯 시작 15분 전 ~ 시작 사이에 끝나는 일정
      if (e.end <= start && e.end > start - BACK_TO_BACK_BUFFER) {
        effects.push({ code: 'back-to-back', delta: SCORING.backToBack, who: a.id, data: { side: 'before', title: e.title } });
        break;
      }
      // 직후: 슬롯 끝 ~ 끝 15분 후 사이에 시작하는 일정
      if (e.start >= end && e.start < end + BACK_TO_BACK_BUFFER) {
        effects.push({ code: 'back-to-back', delta: SCORING.backToBack, who: a.id, data: { side: 'after', title: e.title } });
        break;
      }
    }
  }
  return effects;
}

/** 집중시간 겹침(사람당 하나). focus는 하드 블로킹하지 않으므로 여기서 감점만. */
function focusOverlapEffects(ctx: SlotContext): ScoreEffect[] {
  const { day, start, end } = ctx;
  const effects: ScoreEffect[] = [];
  for (const a of ctx.participating) {
    const clash = a.events.some((e) => e.day === day && e.kind === 'focus' && overlaps(start, end, e.start, e.end));
    if (clash) effects.push({ code: 'focus-overlap', delta: SCORING.focusOverlap, who: a.id });
  }
  return effects;
}

/** 같은 날 외근 일정이 있으나 슬롯과는 겹치지 않을 때(사람당 하나). 겹치는 필수는 이미 하드필터로 제거됨. */
function offsiteDayEffects(ctx: SlotContext): ScoreEffect[] {
  const { day, start, end } = ctx;
  const effects: ScoreEffect[] = [];
  for (const a of ctx.participating) {
    const offsiteToday = a.events.some(
      (e) => e.day === day && e.kind === 'offsite' && !overlaps(start, end, e.start, e.end),
    );
    if (offsiteToday) effects.push({ code: 'offsite-day', delta: SCORING.offsite, who: a.id });
  }
  return effects;
}

/** 결함⑧: 매직넘버 대신 duration 상대 계산. frameEnd−duration−30 이후 시작이면 감점. */
function lateStartEffects(ctx: SlotContext): ScoreEffect[] {
  const duration = ctx.end - ctx.start;
  const threshold = ctx.frame.end - duration - LATE_START_TAIL;
  return ctx.start >= threshold ? [{ code: 'late-start', delta: SCORING.lateStart }] : [];
}

/**
 * 점심 리듬·점심 보호. 리듬은 예측이 아니라 insights에서 읽는다(없으면 null=침묵).
 * 이중 감점 방지: after-lunch가 걸린 사람은 같은 슬롯의 lunch-squeeze를 건너뛴다(이미 먹었으므로).
 */
function lunchEffects(ctx: SlotContext): ScoreEffect[] {
  const effects: ScoreEffect[] = [];
  for (const person of ctx.participating) {
    const rhythm = ctx.insights[person.id]?.lunchRhythm ?? null;

    const after = afterLunchEffect(person, rhythm, ctx.start);
    if (after) {
      effects.push(after);
      continue; // 점심 직후면 squeeze는 무의미 — 건너뛴다
    }

    const before = beforeLunchEffect(person, rhythm, ctx.end);
    if (before) effects.push(before);

    const squeeze = lunchSqueezeEffect(person, ctx.day, { start: ctx.start, end: ctx.end });
    if (squeeze) effects.push(squeeze);
  }
  return effects;
}

export function scoreSlot(args: {
  day: string;
  start: Minutes;
  end: Minutes;
  attendees: Attendee[];
  insights: Record<string, PersonInsights>;
  rooms: Room[];
}): { effects: ScoreEffect[]; partials: PartialInfo[]; roomIds: string[] } {
  const { day, start, end, attendees, insights, rooms } = args;
  const required = attendees.filter((a) => a.attendanceType === 'required');
  const optional = attendees.filter((a) => a.attendanceType === 'optional');

  const optionalResult = evaluateOptional(optional, day, start, end);
  const availableOptional = optional.filter((a) => optionalResult.availableIds.has(a.id));

  const ctx: SlotContext = {
    day,
    start,
    end,
    frame: requiredFrame(attendees),
    required,
    optional,
    availableOptional,
    participating: [...required, ...availableOptional],
    insights,
  };

  const effects: ScoreEffect[] = [];
  // 하드필터가 필수 전원 통과를 보장 — 포매터의 "필수 N명" 라인을 위해 항상 한 번 남긴다.
  if (required.length > 0) effects.push({ code: 'all-required-ok', delta: 0 });
  effects.push(...optionalResult.effects);
  effects.push(...backToBackEffects(ctx));
  effects.push(...focusOverlapEffects(ctx));
  effects.push(...offsiteDayEffects(ctx));
  effects.push(...lateStartEffects(ctx));
  effects.push(...lunchEffects(ctx));

  // 회의실: 미설정([])이면 관심사가 아니므로 평가를 건너뛴다. 실제 방이 있는데 다 찼으면 no-room.
  let roomIds: string[] = [];
  if (rooms.length > 0) {
    const headcount = required.length + availableOptional.length;
    roomIds = availableRooms(rooms, day, start, end, headcount).map((r) => r.id);
    if (roomIds.length === 0) effects.push({ code: 'no-room', delta: SCORING.noRoom });
  }

  return { effects, partials: optionalResult.partials, roomIds };
}
