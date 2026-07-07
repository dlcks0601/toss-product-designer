import { describe, it, expect } from 'vitest';
import { rankSlots, needsDecisionMoment } from './scheduler';
import { isBusinessDay } from './time';
import type { Attendee, CandidateSlot, CalendarEvent, EventKind, PersonInsights, Room, Rules } from './types';

const person = (over: Partial<Attendee>): Attendee => ({
  id: 'a1', name: '김지은', role: 'PO', faceId: 'f1',
  attendanceType: 'required', workHours: { start: 540, end: 1080 }, events: [], ...over,
});
const ev = (id: string, day: string, start: number, end: number, kind: EventKind, title = '일정'): CalendarEvent => ({
  id, day, start, end, title, kind,
});
const rules: Rules = { days: ['2026-07-06'], durationMinutes: 60, deadline: 'this-week' };
const noInsights: Record<string, PersonInsights> = {};
const rank = (attendees: Attendee[], over: Partial<Rules> = {}, rooms: Room[] = []) =>
  rankSlots({ attendees, rules: { ...rules, ...over }, rooms, insights: noInsights });

describe('하드 필터', () => {
  it('필수 참석자의 회의와 겹치는 슬롯을 제거한다', () => {
    const slots = rank([person({ events: [ev('e1', '2026-07-06', 600, 660, 'meeting')] })]);
    expect(slots.some((s) => s.start < 660 && s.end > 600)).toBe(false);
  });
  it('필수 참석자의 personal 일정도 하드 블로킹한다', () => {
    const slots = rank([person({ events: [ev('e1', '2026-07-06', 600, 660, 'personal')] })]);
    expect(slots.some((s) => s.start < 660 && s.end > 600)).toBe(false);
  });
  it('focus는 하드 블로킹하지 않는다 — 슬롯은 남고 focus-overlap로 감점만', () => {
    const slots = rank([person({ events: [ev('e1', '2026-07-06', 600, 660, 'focus')] })]);
    const at1000 = slots.find((s) => s.start === 600)!;
    expect(at1000).toBeDefined();
    expect(at1000.reasons.some((r) => r.code === 'focus-overlap')).toBe(true);
  });
  it('필수 참석자의 근무시간 밖 슬롯을 제거한다 — 유연근무', () => {
    const flex = person({ id: 'a3', workHours: { start: 600, end: 1140 } }); // 10:00–19:00
    expect(rank([flex]).every((s) => s.start >= 600)).toBe(true);
  });
  it('선택 참석자의 충돌은 슬롯을 제거하지 않고 optional-unavailable로 기록한다', () => {
    const opt = person({ id: 'a4', attendanceType: 'optional', events: [ev('e2', '2026-07-06', 540, 1080, 'meeting')] });
    const slots = rank([person({ id: 'a5' }), opt]);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].reasons.some((r) => r.code === 'optional-unavailable' && r.who === 'a4')).toBe(true);
  });
});

describe('정렬·severity·점수', () => {
  it('score는 effect delta의 합이고, score 내림차순 정렬', () => {
    const slots = rank([person({})]);
    for (let i = 1; i < slots.length; i++) expect(slots[i - 1].score).toBeGreaterThanOrEqual(slots[i].score);
  });
  it('동점이면 더 이른 날짜, 그다음 더 이른 시각 순', () => {
    const slots = rank([person({})], { days: ['2026-07-06', '2026-07-07'] });
    const top = slots.filter((s) => s.score === slots[0].score);
    for (let i = 1; i < top.length; i++) {
      const prev = top[i - 1], cur = top[i];
      expect(prev.day < cur.day || (prev.day === cur.day && prev.start <= cur.start)).toBe(true);
    }
  });
  it('severity는 warning>tradeoff>good로 매핑된다', () => {
    const busyOffsite = person({ events: [ev('e', '2026-07-06', 900, 1020, 'offsite')] }); // offsite-day=warning
    const slot = rank([busyOffsite])[0];
    expect(slot.severity).toBe('warning');
  });
});

describe('결함⑥ 주말 가드', () => {
  it('rules.days에 주말이 섞여도 주말 슬롯은 만들지 않는다', () => {
    const slots = rank([person({})], { days: ['2026-07-06', '2026-07-11', '2026-07-12'] }); // 월/토/일
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => isBusinessDay(s.day))).toBe(true);
    expect(slots.some((s) => s.day === '2026-07-11' || s.day === '2026-07-12')).toBe(false);
  });
  it('주말만 주어지면 빈 배열', () => {
    expect(rank([person({})], { days: ['2026-07-11', '2026-07-12'] })).toEqual([]);
  });
});

describe('빈 프레임 graceful(예외 없음)', () => {
  it('필수 근무시간 교집합이 비면 빈 배열, 예외 없음', () => {
    const morning = person({ id: 'm', workHours: { start: 540, end: 720 } });  // 09–12
    const evening = person({ id: 'e', workHours: { start: 840, end: 1080 } }); // 14–18
    expect(() => rank([morning, evening])).not.toThrow();
    expect(rank([morning, evening])).toEqual([]);
  });
});

describe('rankSlots opts — 허락제 부분 참석(allow-partial-required)', () => {
  // 준호는 09:00–10:00 + 10:30–18:00로 60분 온전한 슬롯이 없다.
  const junho = () => person({
    id: 'j', name: '준호',
    events: [ev('e1', '2026-07-06', 540, 600, 'meeting', '아침 회의'), ev('e2', '2026-07-06', 630, 1080, 'meeting', '종일 워크숍')],
  });

  it('opts 없으면 정상 경로와 완전히 동일하다(회귀 가드)', () => {
    const attendees = [person({ events: [ev('f', '2026-07-06', 600, 660, 'focus')] }), person({ id: 'opt', attendanceType: 'optional', events: [ev('g', '2026-07-06', 540, 630, 'meeting', '겹침')] })];
    const args = { attendees, rules, rooms: [], insights: noInsights };
    expect(rankSlots(args)).toEqual(rankSlots(args, {}));
    expect(rankSlots(args)).toEqual(rankSlots(args, { allowPartialFor: undefined }));
  });

  it('대상이 부분 참석 가능한 슬롯만 하드필터를 통과시킨다', () => {
    const args = { attendees: [junho()], rules, rooms: [], insights: noInsights };
    expect(rankSlots(args)).toEqual([]); // 정상 경로: 온전한 슬롯 없음
    const opened = rankSlots(args, { allowPartialFor: 'j' });
    expect(opened.map((s) => s.start)).toEqual([570, 600]); // 09:30(뒤 30분), 10:00(앞 30분)
  });

  it('통과한 부분 슬롯에 optional-partial effect·PartialInfo를 붙이고 severity는 tradeoff, delta 0', () => {
    // 슬롯 중앙~뒤를 막는 단일 블록(10:00–10:30) — 인접 back-to-back이 없어 부분 effect의 delta 0을 깨끗이 검증.
    const target = person({ id: 'j', name: '준호', events: [ev('e', '2026-07-06', 600, 630, 'meeting', '중간 블록')] });
    const opened = rankSlots({ attendees: [target], rules, rooms: [], insights: noInsights }, { allowPartialFor: 'j' });
    const partialSlot = opened.find((s) => s.start === 600)!; // 10:00–11:00, 준호는 뒤 30분만
    expect(partialSlot.partials).toHaveLength(1);
    expect(partialSlot.partials[0].attendeeId).toBe('j');
    expect(partialSlot.reasons.some((r) => r.code === 'optional-partial' && r.who === 'j')).toBe(true);
    expect(partialSlot.severity).toBe('tradeoff');
    expect(partialSlot.score).toBe(0); // delta 0 — 부분 effect 자체는 점수 불변
  });

  it("대상의 'none' 충돌은 여전히 막고, 다른 필수의 충돌도 막는다", () => {
    // 09:00–12:00 종일 앞막힘(none), 그리고 다른 필수가 오후 전체를 막음 → 부분 허용해도 안 열린다.
    const target = person({ id: 'j', events: [ev('e1', '2026-07-06', 540, 720, 'meeting', '오전 블록')] });
    const other = person({ id: 'o', events: [ev('e2', '2026-07-06', 720, 1080, 'meeting', '오후 블록')] });
    const opened = rankSlots({ attendees: [target, other], rules, rooms: [], insights: noInsights }, { allowPartialFor: 'j' });
    expect(opened).toEqual([]);
  });
});

describe('needsDecisionMoment(결함⑤)', () => {
  const slot = (severity: CandidateSlot['severity']): CandidateSlot => ({
    id: 'x', day: '2026-07-06', start: 600, end: 660, score: 0, reasons: [], partials: [], severity, roomIds: [],
  });
  it('표시 후보가 없으면 true', () => {
    expect(needsDecisionMoment([])).toBe(true);
  });
  it('표시 후보 전부가 warning이면 true', () => {
    expect(needsDecisionMoment([slot('warning'), slot('warning')])).toBe(true);
  });
  it('warning이 아닌 후보가 하나라도 있으면 false', () => {
    expect(needsDecisionMoment([slot('warning'), slot('good')])).toBe(false);
    expect(needsDecisionMoment([slot('tradeoff')])).toBe(false);
  });
});
