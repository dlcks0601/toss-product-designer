import type { DeadlineKind } from './types';
import { addDaysISO, isBusinessDay, weekdayIndex } from './time';

/**
 * 앵커(오늘) — 라이브. 심사자가 언제 열어도 '오늘'이 진짜 오늘이어야 한다(사용자 계약 변경:
 * 앵커 해석에 한해 실시간 시계 허용 — 그 아래 세계·엔진은 여전히 앵커 상대 결정적).
 * KST 고정 계산 — 서버/클라이언트가 같은 날짜를 보게 해 하이드레이션 불일치를 막는다.
 * 주말이면 다음 월요일로 넘긴다(영업일 세계). 테스트는 NEXT_PUBLIC_ANCHOR로
 * 고정 앵커(2026-07-07 화)를 주입해 요일 안무 계약을 그대로 검증한다.
 */
function resolveAnchor(): string {
  const fixed = process.env.NEXT_PUBLIC_ANCHOR;
  if (fixed) return fixed;
  const kst = new Date(Date.now() + 9 * 3600_000);
  const iso = kst.toISOString().slice(0, 10);
  const wd = weekdayIndex(iso); // 0=월 … 5=토, 6=일
  if (wd === 5) return addDaysISO(iso, 2);
  if (wd === 6) return addDaysISO(iso, 1);
  return iso;
}
export const ANCHOR_DATE = resolveAnchor();

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
