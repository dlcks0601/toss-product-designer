import { describe, expect, it } from 'vitest';
import { mondayOf, weekIndexOf, weekLabel, weekMondays } from './weeks';
import { windowFor } from './window';

describe('mondayOf', () => {
  it('주중 어느 날이든 그 주 월요일로 간다', () => {
    expect(mondayOf('2026-07-13')).toBe('2026-07-13'); // 월 → 자기 자신
    expect(mondayOf('2026-07-15')).toBe('2026-07-13'); // 수
    expect(mondayOf('2026-07-17')).toBe('2026-07-13'); // 금
    expect(mondayOf('2026-07-12')).toBe('2026-07-06'); // 일 → 지난 월요일
  });
});

describe('weekMondays', () => {
  it('this-week 창은 한 주(7/6)', () => {
    expect(weekMondays(windowFor('this-week'))).toEqual(['2026-07-06']);
  });

  it('next-week 창은 두 주(7/6, 7/13)', () => {
    expect(weekMondays(windowFor('next-week'))).toEqual(['2026-07-06', '2026-07-13']);
  });

  it('flexible 창은 세 주', () => {
    expect(weekMondays(windowFor('flexible'))).toEqual(['2026-07-06', '2026-07-13', '2026-07-20']);
  });
});

describe('weekIndexOf', () => {
  const window = windowFor('next-week');

  it('창 첫 주=0, 둘째 주=1', () => {
    expect(weekIndexOf('2026-07-08', window)).toBe(0);
    expect(weekIndexOf('2026-07-15', window)).toBe(1);
  });

  it('창 밖 주는 -1', () => {
    expect(weekIndexOf('2026-08-03', window)).toBe(-1);
  });
});

describe('weekLabel', () => {
  it('0=이번 주, 1=다음 주, 2=그다음 주, 그 밖은 n주 차', () => {
    expect(weekLabel(0)).toBe('이번 주');
    expect(weekLabel(1)).toBe('다음 주');
    expect(weekLabel(2)).toBe('그다음 주');
    expect(weekLabel(3)).toBe('4주 차');
  });
});
