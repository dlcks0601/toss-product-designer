import { describe, it, expect } from 'vitest';
import { availableRooms } from './rooms';
import type { Room } from './types';

const room = (over: Partial<Room>): Room => ({
  id: 'r1', name: '회의실 A', capacity: 6, floorNote: '3층', events: [], ...over,
});

describe('availableRooms', () => {
  it('정원 미달 회의실은 제외한다', () => {
    const rooms = [room({ id: 'small', capacity: 2 }), room({ id: 'big', capacity: 10 })];
    const out = availableRooms(rooms, '2026-07-06', 600, 660, 6);
    expect(out.map((r) => r.id)).toEqual(['big']);
  });
  it('같은 날 겹치는 예약이 있으면 제외한다', () => {
    const rooms = [room({ id: 'busy', events: [{ day: '2026-07-06', start: 630, end: 690 }] })];
    expect(availableRooms(rooms, '2026-07-06', 600, 660, 4)).toHaveLength(0);
  });
  it('경계 접촉(예약 10:00 종료, 회의 10:00 시작)은 겹침이 아니다', () => {
    const rooms = [room({ events: [{ day: '2026-07-06', start: 540, end: 600 }] })];
    expect(availableRooms(rooms, '2026-07-06', 600, 660, 4)).toHaveLength(1);
  });
  it('다른 날 예약은 무시한다', () => {
    const rooms = [room({ events: [{ day: '2026-07-07', start: 600, end: 660 }] })];
    expect(availableRooms(rooms, '2026-07-06', 600, 660, 4)).toHaveLength(1);
  });
});
