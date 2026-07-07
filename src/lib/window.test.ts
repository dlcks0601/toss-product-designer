import { describe, it, expect } from 'vitest';
import { ANCHOR_DATE, windowFor } from './window';
import { isBusinessDay } from './time';

describe('windowFor — 기한 윈도우', () => {
  it('ANCHOR_DATE는 2026-07-07(화)', () => {
    expect(ANCHOR_DATE).toBe('2026-07-07');
  });

  it('this-week: 앵커 다음날부터 이번 주 금요일까지 영업일 — 7/8,7/9,7/10', () => {
    expect(windowFor('this-week')).toEqual(['2026-07-08', '2026-07-09', '2026-07-10']);
  });

  it('next-week는 7/8~7/10 + 7/13~7/17 — 주말·과거 없음', () => {
    expect(windowFor('next-week')).toEqual([
      '2026-07-08', '2026-07-09', '2026-07-10',
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
    ]);
  });

  it('flexible: + 그 다음 주 — 7/8~7/24 영업일 13개', () => {
    expect(windowFor('flexible')).toEqual([
      '2026-07-08', '2026-07-09', '2026-07-10',
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
      '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24',
    ]);
  });

  it('모든 날짜는 앵커 이후 영업일이다 — 주말·과거 없음', () => {
    for (const d of windowFor('flexible')) {
      expect(d > ANCHOR_DATE).toBe(true);
      expect(isBusinessDay(d)).toBe(true);
    }
  });

  it('anchor를 넘기면 그 앵커 기준 — 금요일 앵커면 this-week는 빈 배열', () => {
    expect(windowFor('this-week', '2026-07-10')).toEqual([]); // 7/10 금
  });

  it('anchor를 넘기면 그 앵커 기준 — 월요일 앵커면 this-week는 화~금', () => {
    expect(windowFor('this-week', '2026-07-06')).toEqual([
      '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
    ]);
  });
});
