/**
 * 공용 시간 유틸 — 순수·결정론적 함수만 포함한다.
 *
 * HARD RULES:
 * - Date.now(), 인자 없는 new Date(), Math.random() 사용 금지.
 * - 모든 날짜 파싱은 UTC로 통일한다: `new Date(iso + 'T00:00:00Z')`만 사용.
 *
 * v1 참고(포팅 대상, 3중 복제 해소):
 * - overlaps, weekdayIndex: scheduler.ts:31-45 (로컬 파싱 없음, 이미 UTC)
 * - addDaysISO, businessDaysFrom 계열: relaxation.ts:19-44 (toISODate/nextBusinessDays)
 * - fmtTime/fmtRange/fmtDayKorean: format.ts (v1은 로컬 파싱 — 여기서는 UTC로 교정)
 */

const DAY_MS = 86400000;

/** 자정 기준 분 (예: 09:00 = 540) */
export type Minutes = number;

/** 두 구간의 겹침 여부를 반환한다. 경계가 맞닿기만 하는 경우는 겹침으로 보지 않는다. */
export function overlaps(aS: Minutes, aE: Minutes, bS: Minutes, bE: Minutes): boolean {
  return aS < bE && aE > bS;
}

/**
 * ISO 날짜 문자열(YYYY-MM-DD)로부터 요일 인덱스를 계산한다 (0=월 … 6=일, UTC 기준).
 * 현재 시각에 의존하지 않고, 주어진 문자열만 파싱한다.
 */
export function weekdayIndex(isoDate: string): number {
  const jsDay = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토
  return (jsDay + 6) % 7; // 0=월 … 6=일
}

/** 월~금이면 true (UTC 기준). */
export function isBusinessDay(isoDate: string): boolean {
  return weekdayIndex(isoDate) <= 4;
}

/** ms(UTC epoch) → 'YYYY-MM-DD' */
function toISODate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** isoDate에 n일을 더한 날짜를 UTC 기준으로 반환한다 (n은 음수 가능). */
export function addDaysISO(isoDate: string, n: number): string {
  const ms = new Date(`${isoDate}T00:00:00Z`).getTime() + n * DAY_MS;
  return toISODate(ms);
}

/** isoDate 다음(당일 제외) 영업일(월~금) count개를 순서대로 반환한다 (주말 건너뜀). */
export function businessDaysFrom(isoDate: string, count: number): string[] {
  const result: string[] = [];
  let ms = new Date(`${isoDate}T00:00:00Z`).getTime();
  while (result.length < count) {
    ms += DAY_MS;
    const iso = toISODate(ms);
    if (isBusinessDay(iso)) {
      result.push(iso);
    }
  }
  return result;
}

/** 자정 기준 분 → 12시간제 한국어 시각 (예: 690 → '오전 11:30'). */
export function fmtTime(m: Minutes): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(min).padStart(2, '0')}`;
}

/** 시작·끝 분 → '오전 10:00–11:00'. 오전/오후가 같으면 끝 시각의 접두어를 생략한다. */
export function fmtRange(s: Minutes, e: Minutes): string {
  const samePeriod = s < 720 === e < 720;
  const endLabel = samePeriod ? fmtTime(e).replace(/^오[전후] /, '') : fmtTime(e);
  return `${fmtTime(s)}–${endLabel}`;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** ISO 날짜 문자열 → '7월 13일 (월)' (UTC 기준). */
export function fmtDayKorean(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DAY_LABELS[d.getUTCDay()]})`;
}
