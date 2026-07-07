import { describe, it, expect } from 'vitest';
import { suggestRelaxations, findBottleneck } from './relaxation';
import { rankSlots } from './scheduler';
import { windowFor } from './window';
import type { Attendee, CalendarEvent, EventKind, PersonInsights, Room, Rules } from './types';

const person = (over: Partial<Attendee>): Attendee => ({
  id: 'a1', name: '김지은', role: 'PO', faceId: 'f1',
  attendanceType: 'required', workHours: { start: 540, end: 1080 }, events: [], ...over,
});
const ev = (id: string, day: string, start: number, end: number, kind: EventKind = 'meeting', title = '일정'): CalendarEvent =>
  ({ id, day, start, end, title, kind });
const noInsights: Record<string, PersonInsights> = {};
const rules = (over: Partial<Rules> = {}): Rules => ({
  days: windowFor('this-week'), durationMinutes: 60, deadline: 'this-week', ...over,
});
const sim = (attendees: Attendee[], over: Partial<Rules> = {}, rooms: Room[] = []) =>
  suggestRelaxations({ attendees, rules: rules(over), rooms, insights: noInsights });

// 이번 주(7/8) 하루가 전원 필수로 완전히 막힌 입력: A 09:00–14:00, B 13:00–18:00 → 60분 슬롯이 하나도 안 남는다.
// deadline='flexible'로 두어 extend-deadline 후보는 만들지 않는다(rooms/making 테스트 격리용).
function blocked(): Attendee[] {
  const a = person({ id: 'A', name: '가온', events: [ev('e1', '2026-07-08', 540, 840)] });
  const b = person({ id: 'B', name: '나래', events: [ev('e2', '2026-07-08', 780, 1080)] });
  return [a, b];
}
const oneDay: Partial<Rules> = { days: ['2026-07-08'], deadline: 'flexible' };

describe('suggestRelaxations — 실제 시뮬레이션', () => {
  it('opens>0만, opens 내림차순, 최대 3개', () => {
    const out = sim(blocked(), oneDay);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.length).toBeLessThanOrEqual(3);
    for (const s of out) expect(s.opens).toBeGreaterThan(0);
    for (let i = 1; i < out.length; i++) expect(out[i - 1].opens).toBeGreaterThanOrEqual(out[i].opens);
  });

  it('make-optional 라벨은 정확한 해요체 패턴이다', () => {
    const out = sim(blocked(), oneDay);
    const mo = out.find((s) => s.kind === 'make-optional');
    expect(mo?.label).toMatch(/님을 선택 참석으로 바꿔요$/);
    expect(mo?.targetId).toBeDefined();
  });

  it('완화 시뮬은 rooms를 통과시킨다 — 방 없는 시간을 "열렸다"고 말하지 않는다(결함②)', () => {
    // 7/8 종일 예약된 방 하나뿐 → 열리는 슬롯은 전부 방이 없어야 한다(정직한 no-room).
    const bookedRoom: Room = {
      id: 'r1', name: '단풍', capacity: 8, floorNote: '3층',
      events: [{ day: '2026-07-08', start: 540, end: 1080 }],
    };
    const withBooked = sim(blocked(), oneDay, [bookedRoom]);
    const top = withBooked[0];
    expect(top.bestSlot).not.toBeNull();
    expect(top.bestSlot!.reasons.some((r) => r.code === 'no-room')).toBe(true);

    // 대조: 같은 시각에 빈 방을 주면 no-room이 사라지고 roomIds가 찬다 → rooms가 실제로 반영됨.
    const freeRoom: Room = { id: 'r2', name: '벚꽃', capacity: 8, floorNote: '3층', events: [] };
    const withFree = sim(blocked(), oneDay, [freeRoom]);
    expect(withFree[0].bestSlot!.reasons.some((r) => r.code === 'no-room')).toBe(false);
    expect(withFree[0].bestSlot!.roomIds.length).toBeGreaterThan(0);
  });

  it('extend-deadline의 label과 patch가 같은 창을 가리킨다(결함④)', () => {
    // this-week(7/8~7/10) 전부 막힘 → 다음 주로 미루면 열린다. label의 "다음 주"와 patch의 windowFor("next-week")가 일치.
    const busy = person({
      id: 'A', name: '가온',
      events: [
        ev('e1', '2026-07-08', 540, 1080), ev('e2', '2026-07-09', 540, 1080), ev('e3', '2026-07-10', 540, 1080),
      ],
    });
    const out = suggestRelaxations({ attendees: [busy], rules: rules(), rooms: [], insights: noInsights });
    const extend = out.find((s) => s.kind === 'extend-deadline');
    expect(extend?.label).toBe('기한을 다음 주까지로 미뤄요');

    const expected = rankSlots({
      attendees: [busy], rules: { ...rules(), deadline: 'next-week', days: windowFor('next-week') }, rooms: [], insights: noInsights,
    }).length;
    expect(extend?.opens).toBe(expected);
    expect(extend?.resultSummary).toContain(`후보 ${expected}개`);
    expect(extend?.bestSlot?.day).toBe('2026-07-13'); // this-week 막힘 → 첫 후보는 다음 주 월요일
  });

  it('allow-partial-required: 준호 부분 참석 허용 시 열리는 슬롯 수와 bestSlot 계산(S4)', () => {
    // 준호 필수, 나(주최자) 자유. 준호는 09:00–10:00 + 10:30–18:00로 60분 슬롯이 하나도 온전치 않다(정상 후보 0).
    // 하지만 09:30–10:30(뒤 30분)·10:00–11:00(앞 30분)은 절반이 비어 부분 참석 허용 시 열린다 → opens 2.
    const me = person({ id: 'me', name: '나', isOrganizer: true });
    const junho = person({
      id: 'j', name: '준호',
      events: [ev('e1', '2026-07-08', 540, 600, 'meeting', '아침 회의'), ev('e2', '2026-07-08', 630, 1080, 'meeting', '종일 워크숍')],
    });
    const out = suggestRelaxations({ attendees: [me, junho], rules: rules(oneDay), rooms: [], insights: noInsights });
    const ap = out.find((s) => s.kind === 'allow-partial-required');
    expect(ap?.targetId).toBe('j');
    expect(ap?.label).toBe('준호님이 일부만 함께해도 괜찮다면');
    expect(ap?.opens).toBe(2);
    expect(ap?.bestSlot?.day).toBe('2026-07-08');
    expect(ap?.bestSlot?.start).toBe(570); // 09:30 (가장 이른 부분 슬롯)
    expect(ap?.resultSummary).toBe('7월 8일 (수) 오전 9:30이 열려요 · 후보 2개');
    // 부분 참석은 준호에게도 optional-partial 카피로 읽힌다.
    expect(ap?.bestSlot?.reasons.some((r) => r.code === 'optional-partial' && r.who === 'j')).toBe(true);
  });
});

describe('findBottleneck', () => {
  it('findBottleneck는 주최자를 지목하지 않는다', () => {
    // 주최자 종일 회의로 전원 막힘. 주최자 제외 시 지목할 비주최자 병목이 없어 null.
    const me = person({ id: 'me', name: '나', isOrganizer: true, events: [ev('m', '2026-07-08', 540, 1080, 'meeting', '주최자 종일')] });
    const junho = person({ id: 'j', name: '준호', events: [ev('j1', '2026-07-08', 540, 720, 'meeting', '준호 오전')] });
    const result = findBottleneck({ attendees: [me, junho], rules: rules(oneDay), rooms: [], insights: noInsights });
    expect(result).toBeNull();
  });

  it('한 사람의 일정이 병목이면 그 사람과 이벤트 제목을 지목한다', () => {
    const me = person({ id: 'me', name: '나', isOrganizer: true });
    const junho = person({ id: 'j', name: '준호', events: [ev('j1', '2026-07-08', 540, 1080, 'meeting', '종일 워크숍')] });
    const result = findBottleneck({ attendees: [me, junho], rules: rules(oneDay), rooms: [], insights: noInsights });
    expect(result).toEqual({ personId: 'j', eventTitle: '종일 워크숍' });
  });

  it('아무도 제외해도 후보가 늘지 않으면 null', () => {
    const a = person({ id: 'a', name: '가온' });
    const b = person({ id: 'b', name: '나래' });
    expect(findBottleneck({ attendees: [a, b], rules: rules(oneDay), rooms: [], insights: noInsights })).toBeNull();
  });
});
