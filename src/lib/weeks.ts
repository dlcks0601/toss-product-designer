/**
 * 주(週) 계산 헬퍼 — 기한 창을 주 단위로 썰거나 라벨을 붙일 때 쓰는 순수 함수들.
 * (구 MiniLocator에서 이동 — 시간 찾기 주 스트립 달력과 테스트가 같은 수학을 쓴다.)
 */
import { addDaysISO, weekdayIndex } from './time';

/** ISO 날짜가 속한 주의 월요일. */
export function mondayOf(isoDate: string): string {
  return addDaysISO(isoDate, -weekdayIndex(isoDate));
}

/** 기한 창이 걸치는 주들의 월요일(정렬·중복 제거). windowFor 출력은 이미 오름차순이다. */
export function weekMondays(windowDays: string[]): string[] {
  const mondays: string[] = [];
  for (const day of windowDays) {
    const monday = mondayOf(day);
    if (mondays[mondays.length - 1] !== monday) mondays.push(monday);
  }
  return mondays;
}

/** day가 기한 창의 몇 번째 주인지(0부터). 창 밖 주면 -1. */
export function weekIndexOf(day: string, windowDays: string[]): number {
  return weekMondays(windowDays).indexOf(mondayOf(day));
}

/** 주차 라벨 — 앵커(오늘)가 속한 주가 0이다. 데모 창은 최대 3주. */
export function weekLabel(index: number): string {
  if (index === 0) return '이번 주';
  if (index === 1) return '다음 주';
  if (index === 2) return '그다음 주';
  return `${index + 1}주 차`;
}
