/**
 * 점심 리듬·점심 보호 규칙 — 순수·결정론적.
 *
 * 제품 논리: 점심은 자율(11:00~15:00). 예측하지 않는다 — 리듬이 있을 때만 읽고,
 * 리듬 유무와 무관하게 점심 시간을 보호한다. 고정 회사 점심은 어디에도 없다.
 *
 * 델타 상수는 scoring.ts SCORING 표를 공유한다(계약: Task 4~6 전체가 한 표를 쓴다).
 * 함수 본문에서만 참조하므로 scoring.ts와의 순환 import는 초기화 시점에 서로를 읽지 않아 안전하다.
 */
import type { Minutes } from './time';
import { overlaps } from './time';
import type { Attendee, LunchRhythm, ScoreEffect } from './types';
import { SCORING } from './scoring';

/** 점심 창 11:00~15:00 (분). 이 밖의 슬롯은 점심을 침해하지 않는다. */
const LUNCH_WINDOW = { start: 660, end: 900 } as const;
/** 점심 직후 나른함 꼬리 — 리듬 종료 시각부터 이 길이만큼. */
const AFTER_LUNCH_TAIL = 30;
/** 점심 직전 보너스 리드 — 리듬 시작 시각 직전 이 길이 안에 끝나면 산뜻. */
const BEFORE_LUNCH_LEAD = 30;
/** 점심에 필요한 최소 연속 여유(분). 이보다 짧으면 squeeze. */
const MIN_LUNCH_GAP = 60;

/**
 * 점심 직후: 리듬이 있고 슬롯 시작이 [rhythm.end, rhythm.end+30)에 들어가면 감점.
 * 리듬이 null이면 null — 예측하지 않는다.
 * data.rhythmStart는 카피용(fmtTime), data.rhythmEnd는 완화용(늦추기 여유 = rhythmEnd+30 − slotStart).
 */
export function afterLunchEffect(
  person: Attendee,
  rhythm: LunchRhythm | null,
  slotStart: Minutes,
): ScoreEffect | null {
  if (!rhythm) return null;
  if (slotStart >= rhythm.end && slotStart < rhythm.end + AFTER_LUNCH_TAIL) {
    return {
      code: 'after-lunch',
      delta: SCORING.afterLunch,
      who: person.id,
      data: { rhythmStart: rhythm.start, rhythmEnd: rhythm.end },
    };
  }
  return null;
}

/**
 * 점심 직전 보너스: 리듬이 있고 슬롯이 리듬 시작에 딱 끝나거나 30분 전 이내에 끝나면(slotEnd ∈ (start−30, start]) 가점.
 * slotEnd 기준이라 duration 상대 — 30분 회의도 진짜 직전 슬롯이면 받는다.
 */
export function beforeLunchEffect(
  person: Attendee,
  rhythm: LunchRhythm | null,
  slotEnd: Minutes,
): ScoreEffect | null {
  if (!rhythm) return null;
  if (slotEnd > rhythm.start - BEFORE_LUNCH_LEAD && slotEnd <= rhythm.start) {
    return { code: 'before-lunch-bonus', delta: SCORING.beforeLunch, who: person.id };
  }
  return null;
}

/**
 * 점심 압박: 슬롯이 점심 창(660~900)과 겹칠 때만 검사. 겹치지 않으면 null(리듬 유무 무관).
 * 그날 점유 구간 = 일정(점심 제외 — 점심은 움직일 수 있으니까) + 제안 슬롯, 점심 창으로 클립.
 * 창 안 최장 연속 빈 구간 < 60분이면 감점(data.gap = 그 여유 분).
 */
export function lunchSqueezeEffect(
  person: Attendee,
  day: string,
  slot: { start: Minutes; end: Minutes },
): ScoreEffect | null {
  if (!overlaps(slot.start, slot.end, LUNCH_WINDOW.start, LUNCH_WINDOW.end)) return null;

  const clip = (s: Minutes, e: Minutes): [Minutes, Minutes] | null => {
    const cs = Math.max(s, LUNCH_WINDOW.start);
    const ce = Math.min(e, LUNCH_WINDOW.end);
    return cs < ce ? [cs, ce] : null;
  };

  const busy: [Minutes, Minutes][] = [];
  for (const ev of person.events) {
    if (ev.day !== day || ev.kind === 'lunch') continue;
    const c = clip(ev.start, ev.end);
    if (c) busy.push(c);
  }
  const slotClip = clip(slot.start, slot.end); // 게이트 통과 → 항상 non-null
  if (slotClip) busy.push(slotClip);

  busy.sort((a, b) => a[0] - b[0]);
  let cursor: Minutes = LUNCH_WINDOW.start;
  let longestGap = 0;
  for (const [s, e] of busy) {
    if (s > cursor) longestGap = Math.max(longestGap, s - cursor);
    cursor = Math.max(cursor, e);
  }
  longestGap = Math.max(longestGap, LUNCH_WINDOW.end - cursor);

  if (longestGap < MIN_LUNCH_GAP) {
    return { code: 'lunch-squeeze', delta: SCORING.lunchSqueeze, who: person.id, data: { gap: longestGap } };
  }
  return null;
}
