import type { Minutes } from './time';
import { overlaps } from './time';
import type { Attendee, PartialInfo } from './types';

/**
 * 하드 블로킹되는 이벤트 종류. focus·lunch는 절대 블로킹하지 않는다(움직일 수 있으므로).
 * scoring.ts가 이 상수를 공유한다(재정의 금지) — 의존 방향은 scoring → partial 한쪽뿐이라 순환이 없다.
 */
export const HARD_BLOCK_KINDS = new Set<string>(['meeting', 'offsite', 'personal']);

/**
 * 선택 참석자의 이진 가능/불가를 대체하는 "이만큼은 돼요" 판정 결과.
 * full = 온전히 참석, partial = 앞/뒤 일부만, none = 아예 불가(충돌 일정 제목 동봉).
 */
export type PartialResult =
  | { kind: 'full' }
  | { kind: 'partial'; info: PartialInfo }
  | { kind: 'none'; conflictTitle: string };

/**
 * 하드 블로킹 일정만 보고 슬롯 참석 가능 형태를 판정한다(근무시간은 호출부가 별도 게이트).
 * 겹치는 블로커를 슬롯 안으로 클램프 → 시작순 정렬 → 인접·겹침 병합한 뒤:
 *  - 겹침 없음 → full
 *  - 앞이 비고 뒤가 슬롯 끝까지 막힘 → 앞부분(front) 참석, 분 = 앞 연속 빈 구간
 *  - 뒤가 비고 앞이 슬롯 시작부터 막힘 → 뒷부분(back) 참석, 분 = 뒤 연속 빈 구간
 *  - 앞뒤 양쪽이 남지만 가운데가 막힘, 양쪽이 다 막힘, 또는 남는 구간 < 절반 → none
 * 임계: 남는 연속 구간이 슬롯 길이의 절반 이상이면 partial(정확히 절반도 인정).
 */
export function partialAvailability(
  person: Attendee,
  day: string,
  slot: { start: Minutes; end: Minutes },
): PartialResult {
  const { start, end } = slot;
  const half = (end - start) / 2;

  // 겹치는 하드 블로커만 골라 슬롯 안으로 클램프하고 시작순 정렬.
  const clamped = person.events
    .filter((e) => e.day === day && HARD_BLOCK_KINDS.has(e.kind) && overlaps(start, end, e.start, e.end))
    .map((e) => ({ start: Math.max(e.start, start), end: Math.min(e.end, end), title: e.title }))
    .sort((a, b) => a.start - b.start);

  if (clamped.length === 0) return { kind: 'full' };

  // 인접(맞닿음 포함)·겹침 블로커를 하나의 연속 점유 구간으로 병합. 제목은 구간의 가장 이른 블로커 기준.
  const busy: { start: Minutes; end: Minutes; title: string }[] = [];
  for (const b of clamped) {
    const last = busy[busy.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
    } else {
      busy.push({ ...b });
    }
  }

  const firstTitle = busy[0].title;
  const frontFree = busy[0].start - start; // 슬롯 시작부터 연속으로 비는 시간(≥0)
  const backFree = end - busy[busy.length - 1].end; // 슬롯 끝까지 연속으로 비는 시간(≥0)

  // 앞만 비었다(뒤는 슬롯 끝까지 막힘) → 앞부분 참석
  if (frontFree > 0 && backFree === 0) {
    return frontFree >= half
      ? { kind: 'partial', info: { attendeeId: person.id, part: 'front', minutes: frontFree, conflictTitle: firstTitle } }
      : { kind: 'none', conflictTitle: firstTitle };
  }

  // 뒤만 비었다(앞은 슬롯 시작부터 막힘) → 뒷부분 참석. 발목 잡는 건 마지막 블로커.
  if (backFree > 0 && frontFree === 0) {
    const lastTitle = busy[busy.length - 1].title;
    return backFree >= half
      ? { kind: 'partial', info: { attendeeId: person.id, part: 'back', minutes: backFree, conflictTitle: lastTitle } }
      : { kind: 'none', conflictTitle: firstTitle };
  }

  // 앞뒤가 다 남지만 가운데가 막힘, 또는 앞뒤가 다 막힘 → none(첫 겹침 블로커 제목).
  return { kind: 'none', conflictTitle: firstTitle };
}
