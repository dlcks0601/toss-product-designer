import { describe, it, expect } from 'vitest';
import { partialAvailability } from './partial';
import type { Attendee, CalendarEvent, EventKind } from './types';

const person = (over: Partial<Attendee>): Attendee => ({
  id: 'a1', name: '정하늘', role: 'PO', faceId: 'f1',
  attendanceType: 'optional', workHours: { start: 540, end: 1080 }, events: [], ...over,
});
const ev = (id: string, start: number, end: number, kind: EventKind, title = '일정'): CalendarEvent => ({
  id, day: '2026-07-08', start, end, title, kind,
});
const DAY = '2026-07-08';
const slot = { start: 600, end: 660 }; // 10:00–11:00, 60분(절반=30)

describe('partialAvailability — 이만큼은 돼요', () => {
  it('겹치는 하드 일정이 없으면 full', () => {
    const p = person({ events: [ev('e', 900, 960, 'meeting')] }); // 15:00, 슬롯 밖
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'full' });
  });

  it('경계만 맞닿는 일정(11:00 시작)은 겹침이 아니다 → full', () => {
    const p = person({ events: [ev('e', 660, 720, 'meeting')] }); // 11:00–12:00
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'full' });
  });

  it('10:30부터 회의(뒤가 슬롯 끝까지 막힘) → front 30분 partial', () => {
    const p = person({ events: [ev('e', 630, 720, 'meeting', '11시 회의')] }); // 10:30–12:00
    expect(partialAvailability(p, DAY, slot)).toEqual({
      kind: 'partial',
      info: { attendeeId: 'a1', part: 'front', minutes: 30, conflictTitle: '11시 회의' },
    });
  });

  it('09:00–10:30 회의(앞이 슬롯 시작부터 막힘) → back 30분 partial', () => {
    const p = person({ events: [ev('e', 540, 630, 'meeting', '오전 회의')] });
    expect(partialAvailability(p, DAY, slot)).toEqual({
      kind: 'partial',
      info: { attendeeId: 'a1', part: 'back', minutes: 30, conflictTitle: '오전 회의' },
    });
  });

  it('남는 앞 구간이 정확히 절반(30분)이면 partial로 인정 — 경계 포함', () => {
    const p = person({ events: [ev('e', 630, 660, 'meeting', '회의')] }); // 10:30–11:00
    expect(partialAvailability(p, DAY, slot)).toMatchObject({
      kind: 'partial',
      info: { part: 'front', minutes: 30 },
    });
  });

  it('남는 앞 구간이 절반 미만(20분 < 30분)이면 none', () => {
    const p = person({ events: [ev('e', 620, 720, 'meeting', '회의')] }); // 10:20–
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'none', conflictTitle: '회의' });
  });

  it('앞뒤 양쪽이 막혀 연속으로 남는 구간이 없으면 none', () => {
    // 10:00–10:20 회의 + 10:40–11:00 회의 → 가운데 20분만 남고 앞·뒤 연속 구간은 0
    const p = person({
      events: [ev('a', 600, 620, 'meeting', '앞 회의'), ev('b', 640, 660, 'meeting', '뒤 회의')],
    });
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'none', conflictTitle: '앞 회의' });
  });

  it('가운데만 막히면(앞뒤 다 남지만 중간이 끊김) none', () => {
    const p = person({ events: [ev('e', 620, 640, 'meeting', '중간 회의')] });
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'none', conflictTitle: '중간 회의' });
  });

  it('슬롯 전체를 덮는 종일 일정 → none', () => {
    const p = person({ events: [ev('e', 540, 1080, 'meeting', '종일 회의')] });
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'none', conflictTitle: '종일 회의' });
  });

  it('끝을 덮는 인접한 두 회의는 하나의 연속 구간으로 병합 → front 30분(가짜 중간 공백 없음)', () => {
    const p = person({
      events: [ev('a', 630, 645, 'meeting', '회의 A'), ev('b', 645, 660, 'meeting', '회의 B')],
    });
    expect(partialAvailability(p, DAY, slot)).toEqual({
      kind: 'partial',
      info: { attendeeId: 'a1', part: 'front', minutes: 30, conflictTitle: '회의 A' },
    });
  });

  it('겹치는 두 회의(뒤 회의 끝이 더 늦음)도 병합해 최대 끝으로 본다 → front 30분', () => {
    // 10:30–10:50 + 10:40–11:00 → 병합 10:30–11:00
    const p = person({
      events: [ev('a', 630, 650, 'meeting', '회의 A'), ev('b', 640, 660, 'meeting', '회의 B')],
    });
    expect(partialAvailability(p, DAY, slot)).toMatchObject({
      kind: 'partial',
      info: { part: 'front', minutes: 30 },
    });
  });

  it('personal·offsite도 하드 블로킹으로 본다', () => {
    const p = person({ events: [ev('e', 630, 720, 'personal', '개인 일정')] });
    expect(partialAvailability(p, DAY, slot)).toMatchObject({ kind: 'partial', info: { part: 'front' } });
  });

  it('lunch·focus는 절대 블로킹하지 않는다 → full', () => {
    const p = person({
      events: [ev('l', 630, 720, 'lunch', '점심'), ev('f', 600, 660, 'focus', '집중')],
    });
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'full' });
  });

  it('다른 날 일정은 무시한다 → full', () => {
    const other: CalendarEvent = { id: 'x', day: '2026-07-09', start: 600, end: 660, title: '내일 회의', kind: 'meeting' };
    const p = person({ events: [other] });
    expect(partialAvailability(p, DAY, slot)).toEqual({ kind: 'full' });
  });
});
