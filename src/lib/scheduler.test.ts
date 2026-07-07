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
