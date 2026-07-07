import { describe, it, expect } from 'vitest';
import {
  clampWeek,
  weekDays,
  yPct,
  eventsOn,
  FIRST_MONDAY,
  WEEK_COUNT,
  TODAY,
  DAY_START,
  DAY_END,
} from './HomeCalendar';
import type { CalendarEvent } from '../lib/types';

describe('clampWeek — 7/6 주 ~ 7/20 주(3주)에서 클램프', () => {
  it('범위 안은 그대로', () => {
    expect(clampWeek(0)).toBe(0);
    expect(clampWeek(1)).toBe(1);
    expect(clampWeek(WEEK_COUNT - 1)).toBe(2);
  });
  it('가장자리 밖은 잘린다', () => {
    expect(clampWeek(-1)).toBe(0);
    expect(clampWeek(-99)).toBe(0);
    expect(clampWeek(3)).toBe(2);
    expect(clampWeek(99)).toBe(2);
  });
});

describe('weekDays — 주 인덱스 → 월~금 5일', () => {
  it('0주는 7/6(월)~7/10(금) — 오늘(7/7)이 포함된 주', () => {
    const days = weekDays(0);
    expect(days).toEqual(['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']);
    expect(days[0]).toBe(FIRST_MONDAY);
    expect(days).toContain(TODAY);
  });
  it('1주는 7/13부터, 2주는 7/24로 끝난다 — 데이터 전 기간(7/6~7/24)을 덮는다', () => {
    expect(weekDays(1)[0]).toBe('2026-07-13');
    expect(weekDays(2)[4]).toBe('2026-07-24');
  });
  it('범위 밖 인덱스는 클램프된 주를 반환한다', () => {
    expect(weekDays(9)).toEqual(weekDays(2));
    expect(weekDays(-1)).toEqual(weekDays(0));
  });
});

describe('yPct — 분 → 9~19시 프레임 세로 위치(%)', () => {
  it('프레임 시작·중간·끝', () => {
    expect(yPct(DAY_START)).toBe(0);
    expect(yPct(840)).toBe(50); // 14:00 = 프레임 정중앙
    expect(yPct(DAY_END)).toBe(100);
  });
  it('프레임 밖은 경계로 클램프된다', () => {
    expect(yPct(0)).toBe(0);
    expect(yPct(1440)).toBe(100);
  });
});

describe('eventsOn — 하루치 필터 + 시작 시각 정렬', () => {
  const ev = (id: string, day: string, start: number): CalendarEvent => ({
    id,
    day,
    start,
    end: start + 60,
    title: id,
    kind: 'meeting',
  });
  it('day 일치만 골라 시작 시각 순으로 정렬한다', () => {
    const events = [ev('b', '2026-07-07', 840), ev('a', '2026-07-07', 600), ev('c', '2026-07-08', 540)];
    expect(eventsOn(events, '2026-07-07').map((e) => e.id)).toEqual(['a', 'b']);
    expect(eventsOn(events, '2026-07-09')).toEqual([]);
  });
});
