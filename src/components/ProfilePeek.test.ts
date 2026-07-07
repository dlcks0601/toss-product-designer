import { describe, it, expect } from 'vitest';
import { peekDays, PEEK_DAY_COUNT } from './ProfilePeek';
import { windowFor } from '../lib/window';

describe('peekDays — 피크 미니 캘린더 범위(기한 창 앞 5영업일)', () => {
  it('next-week 창에서는 앞 5영업일(수·목·금 + 다음 주 월·화)만 남긴다', () => {
    expect(peekDays(windowFor('next-week'))).toEqual([
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-13',
      '2026-07-14',
    ]);
  });

  it('this-week 창은 3영업일뿐 — 있는 만큼만(3열)', () => {
    expect(peekDays(windowFor('this-week'))).toEqual(['2026-07-08', '2026-07-09', '2026-07-10']);
  });

  it('flexible 창도 앞 5영업일로 자른다 — 기한이 늘어도 피크는 첫 주만', () => {
    const days = peekDays(windowFor('flexible'));
    expect(days).toHaveLength(PEEK_DAY_COUNT);
    expect(days).toEqual(peekDays(windowFor('next-week')));
  });

  it('입력 배열을 변형하지 않는다(순수)', () => {
    const input = windowFor('next-week');
    const before = [...input];
    peekDays(input);
    expect(input).toEqual(before);
  });
});
