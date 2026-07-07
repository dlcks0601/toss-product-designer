import { describe, it, expect } from 'vitest';
import { SCORING, scoreSlot, requiredFrame } from './scoring';
import type { Attendee, CalendarEvent, EventKind, PersonInsights, Room } from './types';

const person = (over: Partial<Attendee>): Attendee => ({
  id: 'a1', name: '김지은', role: 'PO', faceId: 'f1',
  attendanceType: 'required', workHours: { start: 540, end: 1080 }, events: [], ...over,
});
const ev = (id: string, start: number, end: number, kind: EventKind, title = '일정'): CalendarEvent => ({
  id, day: '2026-07-06', start, end, title, kind,
});
const noInsights: Record<string, PersonInsights> = {};
const noRooms: Room[] = [];

// 필수 참석자만 있고 09:00–18:00 프레임, 아무 이벤트 없는 자유 슬롯
const free = { day: '2026-07-06', attendees: [person({})], insights: noInsights, rooms: noRooms };

describe('scoreSlot — 필수/선택', () => {
  it('필수 통과 슬롯은 all-required-ok effect를 정확히 하나 포함한다', () => {
    const { effects } = scoreSlot({ ...free, start: 600, end: 660 });
    expect(effects.filter((e) => e.code === 'all-required-ok')).toHaveLength(1);
    expect(effects.find((e) => e.code === 'all-required-ok')!.delta).toBe(0);
  });

  it('선택 가능자 가점은 인원 스케일에 눌리지 않는다 — 선택 5명이어도 한 effect·최대 +10, warning(-12)을 못 이긴다', () => {
    const req = person({ id: 'req' });
    const optionals = [1, 2, 3, 4, 5].map((n) => person({ id: `opt${n}`, attendanceType: 'optional' }));
    const { effects } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [req, ...optionals], insights: noInsights, rooms: noRooms,
    });
    const okEffects = effects.filter((e) => e.code === 'optional-ok');
    expect(okEffects).toHaveLength(1); // 정규화: 5개가 아니라 1개
    expect(okEffects[0].delta).toBe(10); // Math.round(10 * 5/5)
    expect(okEffects[0].delta).toBeLessThan(Math.abs(SCORING.afterLunch)); // 10 < 12
  });

  it('일부만 가능한 선택 참석자 — optional-ok는 평균으로 반내림, 불가자는 개별 optional-unavailable', () => {
    const req = person({ id: 'req' });
    const ok1 = person({ id: 'ok1', attendanceType: 'optional' });
    const ok2 = person({ id: 'ok2', attendanceType: 'optional' });
    const busy = person({ id: 'busy', attendanceType: 'optional', events: [ev('e', 600, 660, 'meeting')] });
    const { effects } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [req, ok1, ok2, busy], insights: noInsights, rooms: noRooms,
    });
    expect(effects.find((e) => e.code === 'optional-ok')!.delta).toBe(Math.round(10 * 2 / 3)); // 7
    const un = effects.filter((e) => e.code === 'optional-unavailable');
    expect(un).toHaveLength(1);
    expect(un[0].who).toBe('busy');
    expect(un[0].delta).toBe(0);
  });
});

describe('scoreSlot — 부분 참석 통합(Task 6)', () => {
  it('S1 재현: 선택 참석자가 10:30부터 회의면 optional-partial(+5)·partials에 PartialInfo', () => {
    const req = person({ id: 'req' });
    const hn = person({ id: 'o1', name: '정하늘', attendanceType: 'optional', events: [ev('e', 630, 720, 'meeting', '11시 회의')] });
    const { effects, partials } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [req, hn], insights: noInsights, rooms: noRooms,
    });
    const p = effects.find((e) => e.code === 'optional-partial');
    expect(p).toBeDefined();
    expect(p!.delta).toBe(SCORING.optionalPartial); // +5
    expect(p!.who).toBe('o1');
    expect(partials).toEqual([{ attendeeId: 'o1', part: 'front', minutes: 30, conflictTitle: '11시 회의' }]);
  });

  it('부분 참석자는 optional-ok 정규화(fullOkCount)에서 제외 — +5만 따로 선다', () => {
    const req = person({ id: 'req' });
    const full = person({ id: 'full', attendanceType: 'optional' });
    const part = person({ id: 'part', attendanceType: 'optional', events: [ev('e', 630, 720, 'meeting', '회의')] });
    const { effects, partials } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [req, full, part], insights: noInsights, rooms: noRooms,
    });
    // 완전 가능 1명 / 선택 2명 → round(10 * 1/2) = 5, 부분 참석자는 분자에서 빠진다
    expect(effects.find((e) => e.code === 'optional-ok')!.delta).toBe(5);
    expect(effects.find((e) => e.code === 'optional-partial')!.delta).toBe(SCORING.optionalPartial);
    expect(effects.some((e) => e.code === 'optional-unavailable')).toBe(false);
    expect(partials).toHaveLength(1);
  });

  it('완전 불가(슬롯 전체 겹침)는 여전히 optional-unavailable', () => {
    const req = person({ id: 'req' });
    const busy = person({ id: 'busy', attendanceType: 'optional', events: [ev('e', 600, 660, 'meeting', '회의')] });
    const { effects, partials } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [req, busy], insights: noInsights, rooms: noRooms,
    });
    expect(effects.find((e) => e.code === 'optional-unavailable')!.who).toBe('busy');
    expect(effects.some((e) => e.code === 'optional-partial')).toBe(false);
    expect(partials).toHaveLength(0);
  });
});

describe('scoreSlot — back-to-back(결함③ 양방향)', () => {
  it('직전·직후 붙은 일정은 양방향 모두 effects에 남는다 — 사람당 하나', () => {
    // A: 09:30–10:00 회의(직전), B: 11:00–11:30 회의(직후). 슬롯 10:00–11:00.
    const a = person({ id: 'A', events: [ev('ea', 570, 600, 'meeting', '앞 회의')] });
    const b = person({ id: 'B', events: [ev('eb', 660, 690, 'meeting', '뒤 회의')] });
    const { effects } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [a, b], insights: noInsights, rooms: noRooms,
    });
    const btb = effects.filter((e) => e.code === 'back-to-back');
    expect(btb).toHaveLength(2);
    expect(btb.find((e) => e.who === 'A')!.data).toMatchObject({ side: 'before', title: '앞 회의' });
    expect(btb.find((e) => e.who === 'B')!.data).toMatchObject({ side: 'after', title: '뒤 회의' });
    expect(btb.every((e) => e.delta === SCORING.backToBack)).toBe(true);
  });

  it('직후 외근은 offsite-day만 남기고 back-to-back은 만들지 않는다 — 이중 감점 방지', () => {
    // 슬롯 10:00–11:00, 외근 11:00–11:30(직후 인접, 15분 창 안).
    const a = person({ id: 'A', events: [ev('e', 660, 690, 'offsite', '외근')] });
    const { effects } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [a], insights: noInsights, rooms: noRooms,
    });
    expect(effects.some((e) => e.code === 'back-to-back')).toBe(false);
    const o = effects.find((e) => e.code === 'offsite-day');
    expect(o).toBeDefined();
    expect(o!.delta).toBe(SCORING.offsite);
  });

  it('직후 회의는 back-to-back을 만든다(대조군) — meeting은 스캔 대상', () => {
    const a = person({ id: 'A', events: [ev('e', 660, 690, 'meeting', '뒤 회의')] });
    const { effects } = scoreSlot({
      day: '2026-07-06', start: 600, end: 660, attendees: [a], insights: noInsights, rooms: noRooms,
    });
    const btb = effects.find((e) => e.code === 'back-to-back');
    expect(btb).toBeDefined();
    expect(btb!.delta).toBe(SCORING.backToBack);
    expect(btb!.data).toMatchObject({ side: 'after', title: '뒤 회의' });
  });
});

describe('scoreSlot — focus/offsite/late-start/room', () => {
  it('집중시간과 겹치면 focus-overlap(-5), 하드필터로 제거되진 않는다', () => {
    const a = person({ events: [ev('e', 600, 660, 'focus', '집중')] });
    const { effects } = scoreSlot({ day: '2026-07-06', start: 600, end: 660, attendees: [a], insights: noInsights, rooms: noRooms });
    const f = effects.find((e) => e.code === 'focus-overlap');
    expect(f).toBeDefined();
    expect(f!.delta).toBe(SCORING.focusOverlap);
    expect(f!.who).toBe('a1');
  });

  it('같은 날 외근 일정이 있으면(슬롯과는 안 겹침) offsite-day(-8)', () => {
    const a = person({ events: [ev('e', 900, 1020, 'offsite', '외근')] }); // 15:00–17:00
    const { effects } = scoreSlot({ day: '2026-07-06', start: 600, end: 660, attendees: [a], insights: noInsights, rooms: noRooms });
    const o = effects.find((e) => e.code === 'offsite-day');
    expect(o!.delta).toBe(SCORING.offsite);
    expect(o!.who).toBe('a1');
  });

  it('late-start는 duration 상대 계산 — frameEnd−duration−30 이후만 감점(결함⑧)', () => {
    // 프레임 09:00–18:00(1080), duration 60 → lastStart 1020, 임계 990.
    const late = scoreSlot({ ...free, start: 990, end: 1050 });
    const early = scoreSlot({ ...free, start: 960, end: 1020 });
    expect(late.effects.some((e) => e.code === 'late-start')).toBe(true);
    expect(early.effects.some((e) => e.code === 'late-start')).toBe(false);
    expect(late.effects.find((e) => e.code === 'late-start')!.delta).toBe(SCORING.lateStart);
  });

  it('빈 회의실이 없으면 no-room(-7)과 빈 roomIds', () => {
    const rooms: Room[] = [{ id: 'r1', name: 'A', capacity: 6, floorNote: '3층', events: [{ day: '2026-07-06', start: 600, end: 660 }] }];
    const { effects, roomIds } = scoreSlot({ day: '2026-07-06', start: 600, end: 660, attendees: [person({})], insights: noInsights, rooms });
    expect(roomIds).toHaveLength(0);
    expect(effects.find((e) => e.code === 'no-room')!.delta).toBe(SCORING.noRoom);
  });

  it('회의실이 있으면 roomIds에 담기고 no-room 없음', () => {
    const rooms: Room[] = [{ id: 'r1', name: 'A', capacity: 6, floorNote: '3층', events: [] }];
    const { effects, roomIds } = scoreSlot({ day: '2026-07-06', start: 600, end: 660, attendees: [person({})], insights: noInsights, rooms });
    expect(roomIds).toEqual(['r1']);
    expect(effects.some((e) => e.code === 'no-room')).toBe(false);
  });

  it('rooms 미설정([])이면 회의실 평가를 건너뛴다 — no-room 없음', () => {
    const { effects, roomIds } = scoreSlot({ ...free, start: 600, end: 660 });
    expect(roomIds).toEqual([]);
    expect(effects.some((e) => e.code === 'no-room')).toBe(false);
  });

  it('부분 참석자도 좌석을 차지한다 — 필수 1 + 선택-부분 1 → headcount 2, 정원 1 회의실은 제외', () => {
    const req = person({ id: 'req' });
    const partial = person({ id: 'opt', attendanceType: 'optional', events: [ev('e', 630, 720, 'meeting', '11시 회의')] });
    const rooms: Room[] = [
      { id: 'r1', name: '정원1', capacity: 1, floorNote: '3층', events: [] },
      { id: 'r2', name: '정원2', capacity: 2, floorNote: '3층', events: [] },
    ];
    const { roomIds } = scoreSlot({ day: '2026-07-06', start: 600, end: 660, attendees: [req, partial], insights: noInsights, rooms });
    expect(roomIds).toEqual(['r2']);
  });
});

describe('requiredFrame', () => {
  it('필수 근무시간의 교집합', () => {
    const a = person({ id: 'a', workHours: { start: 540, end: 1080 } });
    const b = person({ id: 'b', workHours: { start: 600, end: 1020 } });
    expect(requiredFrame([a, b])).toEqual({ start: 600, end: 1020 });
  });
  it('필수가 없으면 기본 09:00–18:00', () => {
    expect(requiredFrame([person({ attendanceType: 'optional' })])).toEqual({ start: 540, end: 1080 });
  });
});

// Task 5 — 점심 리듬·점심 보호가 scoreSlot에 통합됐는지(단위 규칙은 lunch.test.ts).
const insightsFor = (id: string, lunchRhythm: PersonInsights['lunchRhythm']): Record<string, PersonInsights> => ({
  [id]: { offsiteWeekdays: [], recurring: [], lunchRhythm, headline: null, scanLine: '' },
});

describe('scoreSlot — 점심 리듬·점심 보호(Task 5)', () => {
  it('점심 직전 보너스는 duration 기준 상대 계산 — 30분 회의도 진짜 직전 슬롯이 받는다', () => {
    const insights = insightsFor('a1', { start: 780, end: 820 }); // 리듬 13:00~13:40
    // 12:30~13:00(750~780) 30분 회의 → slotEnd 780 = 리듬 시작 → 보너스.
    const on = scoreSlot({ ...free, start: 750, end: 780, insights });
    const bonus = on.effects.find((e) => e.code === 'before-lunch-bonus');
    expect(bonus).toBeDefined();
    expect(bonus!.delta).toBe(SCORING.beforeLunch);
    expect(bonus!.who).toBe('a1');
    // 12:00~12:30(720~750): slotEnd 750 = 리듬 시작−30 → 경계 밖, 보너스 없음(진짜 직전만).
    const off = scoreSlot({ ...free, start: 720, end: 750, insights });
    expect(off.effects.some((e) => e.code === 'before-lunch-bonus')).toBe(false);
  });

  it('리듬 있으면 점심 직후 시작은 after-lunch(-12) — 카피용 rhythmStart·완화용 rhythmEnd', () => {
    const insights = insightsFor('a1', { start: 780, end: 820 });
    const { effects } = scoreSlot({ ...free, start: 840, end: 900, insights }); // 14:00 시작
    const after = effects.find((e) => e.code === 'after-lunch');
    expect(after).toBeDefined();
    expect(after!.delta).toBe(SCORING.afterLunch);
    expect(after!.data).toMatchObject({ rhythmStart: 780, rhythmEnd: 820 });
  });

  it('이중 감점 방지: after-lunch가 걸리면 같은 사람·슬롯의 lunch-squeeze는 생략한다', () => {
    // 오전 회의 11:00~13:30(660~810) + 슬롯 14:00~15:00(840~900) → 점심 여유 30분(squeeze 조건) 이지만
    // 슬롯 시작이 점심 직후(리듬 13:00~13:40) 라 after-lunch가 먼저 걸린다 → squeeze 생략.
    const p = person({ events: [ev('m', 660, 810, 'meeting', '오전 블록')] });
    const insights = insightsFor('a1', { start: 780, end: 820 });
    const { effects } = scoreSlot({ day: '2026-07-06', start: 840, end: 900, attendees: [p], insights, rooms: noRooms });
    expect(effects.some((e) => e.code === 'after-lunch')).toBe(true);
    expect(effects.some((e) => e.code === 'lunch-squeeze')).toBe(false); // 이미 먹었으니까
  });

  it('리듬이 없어도 점심은 보호한다 — 여유 30분이면 lunch-squeeze(-8)', () => {
    // insights 비어 있음(리듬 null). 오후 12:30~15:00(750~900) 회의 + 슬롯 11:00~12:00 → 여유 30분.
    const p = person({ events: [ev('m', 750, 900, 'meeting', '오후 블록')] });
    const { effects } = scoreSlot({ day: '2026-07-06', start: 660, end: 720, attendees: [p], insights: noInsights, rooms: noRooms });
    const sq = effects.find((e) => e.code === 'lunch-squeeze');
    expect(sq).toBeDefined();
    expect(sq!.delta).toBe(SCORING.lunchSqueeze);
    expect(sq!.data).toMatchObject({ gap: 30 });
    expect(effects.some((e) => e.code === 'after-lunch')).toBe(false); // 리듬 없으면 예측 안 함
  });
});
