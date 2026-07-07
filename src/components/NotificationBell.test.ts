import { describe, it, expect } from 'vitest';
import { relativeTimeLabel } from './NotificationBell';

describe('relativeTimeLabel — 알림 센터 상대시간', () => {
  it('1분 미만은 방금', () => {
    expect(relativeTimeLabel(0)).toBe('방금');
    expect(relativeTimeLabel(3_000)).toBe('방금');
    expect(relativeTimeLabel(59_999)).toBe('방금');
  });
  it('1분 이상 1시간 미만은 N분 전', () => {
    expect(relativeTimeLabel(60_000)).toBe('1분 전');
    expect(relativeTimeLabel(150_000)).toBe('2분 전');
    expect(relativeTimeLabel(3_599_999)).toBe('59분 전');
  });
  it('1시간 이상은 N시간 전', () => {
    expect(relativeTimeLabel(3_600_000)).toBe('1시간 전');
    expect(relativeTimeLabel(9_000_000)).toBe('2시간 전');
  });
  it('음수(시계 역전)도 방금으로 방어한다', () => {
    expect(relativeTimeLabel(-1_000)).toBe('방금');
  });
});
