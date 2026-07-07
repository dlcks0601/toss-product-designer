import { describe, it, expect } from 'vitest';
import { overlaps, weekdayIndex, businessDaysFrom, fmtTime, fmtDayKorean } from './time';

describe('time', () => {
  it('경계 접촉은 겹침이 아니다', () => { expect(overlaps(600, 660, 660, 720)).toBe(false); });
  it('부분 겹침', () => { expect(overlaps(600, 660, 630, 690)).toBe(true); });
  it('weekdayIndex는 UTC 기준 — 2026-07-06은 월(0), 07-12는 일(6)', () => {
    expect(weekdayIndex('2026-07-06')).toBe(0);
    expect(weekdayIndex('2026-07-12')).toBe(6);
  });
  it('businessDaysFrom은 주말을 건너뛴다 — 금요일 다음 2영업일은 월·화', () => {
    expect(businessDaysFrom('2026-07-10', 2)).toEqual(['2026-07-13', '2026-07-14']);
  });
  it('fmtTime', () => { expect(fmtTime(690)).toBe('오전 11:30'); expect(fmtTime(840)).toBe('오후 2:00'); });
  it('fmtDayKorean은 UTC 기준', () => { expect(fmtDayKorean('2026-07-13')).toBe('7월 13일 (월)'); });
});
