import { describe, expect, it } from 'vitest';
import { densityBins, gridYPct, DENSITY_BIN, GRID_END, GRID_START } from './CandidateGrid';
import type { Attendee, CalendarEvent, EventKind } from '../lib/types';

function person(id: string, events: CalendarEvent[]): Attendee {
  return {
    id,
    name: id,
    role: 'test',
    faceId: id,
    workHours: { start: 540, end: 1080 },
    events,
    attendanceType: 'required',
  };
}

function ev(day: string, start: number, end: number, kind: EventKind): CalendarEvent {
  return { id: `${day}-${start}-${kind}`, day, start, end, title: kind, kind };
}

const DAY = '2026-07-15';
const BIN_COUNT = (GRID_END - GRID_START) / DENSITY_BIN;

describe('densityBins', () => {
  it('9~18시를 30분 칸 18개로 나눈다', () => {
    expect(densityBins([], DAY)).toHaveLength(BIN_COUNT);
    expect(densityBins([], DAY).every((c) => c === 0)).toBe(true);
  });

  it('겹치는 사람 수를 칸별로 센다', () => {
    const a = person('a', [ev(DAY, 600, 660, 'meeting')]); // 10:00–11:00
    const b = person('b', [ev(DAY, 630, 690, 'meeting')]); // 10:30–11:30
    const bins = densityBins([a, b], DAY);
    expect(bins[2]).toBe(1); // 10:00–10:30 — a만
    expect(bins[3]).toBe(2); // 10:30–11:00 — a+b
    expect(bins[4]).toBe(1); // 11:00–11:30 — b만
    expect(bins[5]).toBe(0);
  });

  it('lunch·focus는 세지 않는다(soft) — 하드 블로커만 밀도가 된다', () => {
    const a = person('a', [
      ev(DAY, 720, 780, 'lunch'),
      ev(DAY, 540, 600, 'focus'),
      ev(DAY, 900, 960, 'offsite'),
      ev(DAY, 990, 1020, 'personal'),
    ]);
    const bins = densityBins([a], DAY);
    expect(bins[6]).toBe(0); // 12:00 lunch — 제외
    expect(bins[0]).toBe(0); // 9:00 focus — 제외
    expect(bins[12]).toBe(1); // 15:00 offsite — 포함
    expect(bins[15]).toBe(1); // 16:30 personal — 포함
  });

  it('다른 날 일정은 무시한다', () => {
    const a = person('a', [ev('2026-07-16', 600, 660, 'meeting')]);
    expect(densityBins([a], DAY).every((c) => c === 0)).toBe(true);
  });
});

describe('gridYPct', () => {
  it('프레임(9~18시)을 0~100%로 사상하고 밖은 클램프한다', () => {
    expect(gridYPct(GRID_START)).toBe(0);
    expect(gridYPct(GRID_END)).toBe(100);
    expect(gridYPct(810)).toBe(50);
    expect(gridYPct(0)).toBe(0);
    expect(gridYPct(1440)).toBe(100);
  });
});
