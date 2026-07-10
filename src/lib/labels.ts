/**
 * 조건 옵션·라벨 사전 — 셋업 칩과 시간 찾기 카피가 같은 소스를 읽는다(카피 단일 소스).
 * (구 FindTimeMobile에서 이동.)
 */
import type { DeadlineKind } from './types';

export const DURATION_OPTIONS: { value: 30 | 60 | 90; label: string }[] = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 90, label: '1시간 30분' },
];

export const DEADLINE_OPTIONS: { value: DeadlineKind; label: string }[] = [
  { value: 'this-week', label: '이번 주 안에' },
  { value: 'next-week', label: '다음 주까지' },
  { value: 'flexible', label: '여유 있어요' },
];

export const DURATION_LABEL = Object.fromEntries(DURATION_OPTIONS.map((o) => [o.value, o.label])) as Record<
  30 | 60 | 90,
  string
>;

export const DEADLINE_LABEL = Object.fromEntries(DEADLINE_OPTIONS.map((o) => [o.value, o.label])) as Record<
  DeadlineKind,
  string
>;

/** 타이틀 '{기한 라벨}까지는…'에 붙는 창 라벨 — '까지'에 자연스러운 형태. */
export const WINDOW_LABEL: Record<DeadlineKind, string> = {
  'this-week': '이번 주',
  'next-week': '다음 주',
  flexible: '그 다음 주',
};
