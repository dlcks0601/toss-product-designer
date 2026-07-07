import type { DeadlineKind } from './types';
import { addDaysISO, isBusinessDay, weekdayIndex } from './time';

/** 데모 고정 앵커 — 2026-07-07 (화). 모든 기한 창은 이 날 "이후" 영업일만 담는다. */
export const ANCHOR_DATE = '2026-07-07';

/** 각 기한이 앵커 주의 금요일에서 몇 주 뒤까지 뻗는지. */
const WEEKS_AHEAD: Record<DeadlineKind, number> = {
  'this-week': 0,
  'next-week': 1,
  flexible: 2,
};

/**
 * 기한 종류에 해당하는 후보 날짜(영업일)를 앵커 다음날부터 순서대로 반환한다.
 * 경계는 앵커가 속한 주의 금요일 + (0|1|2)주. 주말·과거는 담지 않는다.
 *  - this-week → 이번 주 남은 영업일 (앵커 7/7 → 7/8·7/9·7/10)
 *  - next-week → + 다음 주 5영업일 (…7/13~7/17)
 *  - flexible  → + 그 다음 주 5영업일 (…7/20~7/24)
 * ISO 날짜 문자열 비교는 사전식이라 그대로 대소 비교한다(모두 zero-padded).
 */
export function windowFor(deadline: DeadlineKind, anchor: string = ANCHOR_DATE): string[] {
  const fridayThisWeek = addDaysISO(anchor, 4 - weekdayIndex(anchor));
  const end = addDaysISO(fridayThisWeek, WEEKS_AHEAD[deadline] * 7);

  const days: string[] = [];
  for (let cursor = addDaysISO(anchor, 1); cursor <= end; cursor = addDaysISO(cursor, 1)) {
    if (isBusinessDay(cursor)) days.push(cursor);
  }
  return days;
}
