import type { Minutes } from './time';
import { overlaps } from './time';
import type { Room } from './types';

/**
 * 주어진 날짜/시간대·인원수를 수용할 수 있는 회의실 목록.
 * 정원 미달(capacity < headcount)이거나 같은 날 예약과 겹치면 제외한다.
 * 경계 접촉(기존 예약이 10:00에 끝나고 새 회의가 10:00에 시작)은 겹침이 아니다 — time.overlaps 재사용.
 */
export function availableRooms(
  rooms: Room[],
  day: string,
  start: Minutes,
  end: Minutes,
  headcount: number,
): Room[] {
  return rooms.filter((room) => {
    if (room.capacity < headcount) return false;
    return !room.events.some((b) => b.day === day && overlaps(start, end, b.start, b.end));
  });
}
