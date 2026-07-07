import { describe, it, expect } from 'vitest';
import { rankSlots } from '../lib/scheduler';
import { windowFor } from '../lib/window';
import { deriveAllInsights } from '../lib/insights';
import { suggestRelaxations } from '../lib/relaxation';
import type { CandidateSlot } from '../lib/types';
import {
  ME_ID, CORE_CAST, ORG, ROOMS, INCOMING_INVITE, RESPONSE_SCRIPT,
  castAsAttendees, DEFAULT_CAST,
} from './world';

// 다음 주 창(누적: 7/8~7/17). 인사이트/스코어링이 공유하는 단일 소스.
const NEXT_WIN = windowFor('next-week');
const THIS_WIN = windowFor('this-week');
const INSIGHTS = deriveAllInsights(ORG, NEXT_WIN);
const CAST = castAsAttendees(DEFAULT_CAST);

/** 스펙 §4 표의 기본 조율 실행: 6인(하늘·세훈 선택), next-week, 60분. */
const setup = (): CandidateSlot[] =>
  rankSlots({
    attendees: CAST,
    rules: { days: NEXT_WIN, durationMinutes: 60, deadline: 'next-week' },
    rooms: ROOMS,
    insights: INSIGHTS,
  });

const at = (slots: CandidateSlot[], day: string, start: number) =>
  slots.find((s) => s.day === day && s.start === start);

describe('세계 골격', () => {
  it('기본 내보내기가 계약대로다', () => {
    expect(ME_ID).toBe('ichan');
    expect(CORE_CAST).toHaveLength(6);
    expect(ORG).toHaveLength(20);
    expect(new Set(ORG.map((p) => p.id)).size).toBe(20); // id 고유
    expect(ROOMS).toHaveLength(4);
    expect(ROOMS.map((r) => r.capacity).sort((a, b) => a - b)).toEqual([2, 4, 8, 10]);
  });
});

describe('S1 — 다음 주 60분, 1위는 수 7/15 10:00(하늘 앞 30분)', () => {
  const slots = setup();

  it('후보가 6~12개다', () => {
    expect(slots.length).toBeGreaterThanOrEqual(6);
    expect(slots.length).toBeLessThanOrEqual(12);
  });

  it('1위 = 수 7/15 10:00', () => {
    expect(slots[0].day).toBe('2026-07-15');
    expect(slots[0].start).toBe(600);
  });

  it('1위에 하늘 앞 30분 부분 참석(PartialInfo)이 있다', () => {
    const top = slots[0];
    const p = top.partials.find((x) => x.attendeeId === 'haneul');
    expect(p).toBeDefined();
    expect(p!.part).toBe('front');
    expect(p!.minutes).toBe(30);
    expect(top.reasons.some((r) => r.code === 'optional-partial' && r.who === 'haneul')).toBe(true);
  });

  it('1위 severity 는 warning 이 아니다', () => {
    expect(slots[0].severity).not.toBe('warning');
  });
});

describe('S2 — 화 7/14 14:00 슬롯에 세훈 after-lunch', () => {
  const slots = setup();
  const slot = at(slots, '2026-07-14', 840);

  it('화 14:00 슬롯이 후보에 있다', () => {
    expect(slot).toBeDefined();
  });

  it('세훈 after-lunch 이유가 있고, rhythmEnd(점심 종료) 데이터가 인사이트에 존재한다', () => {
    expect(slot!.reasons.some((r) => r.code === 'after-lunch' && r.who === 'sehun')).toBe(true);
    // after-lunch 판정의 근거인 세훈 점심 리듬(13:00~13:40) 종료 = 820 이 인사이트에 실재한다.
    expect(INSIGHTS['sehun'].lunchRhythm).toEqual({ start: 780, end: 820 });
  });
});

describe('S3 — 목 7/16 11:00 슬롯에 준호 외근 + 서연 점심 압박', () => {
  const slots = setup();
  const slot = at(slots, '2026-07-16', 660);

  it('목 11:00 슬롯이 후보에 있다', () => {
    expect(slot).toBeDefined();
  });

  it('준호 offsite-day 와 서연 lunch-squeeze 를 동시에 담는다', () => {
    expect(slot!.reasons.some((r) => r.code === 'offsite-day' && r.who === 'junho')).toBe(true);
    expect(slot!.reasons.some((r) => r.code === 'lunch-squeeze' && r.who === 'seoyeon')).toBe(true);
  });
});

describe('S4 — 이번 주는 막혀 있고, 준호 부분 허용이 탈출구다', () => {
  const rules = { days: THIS_WIN, durationMinutes: 60, deadline: 'this-week' as const };

  it('이번 주(7/8~7/10) 60분 후보가 0개다', () => {
    const slots = rankSlots({ attendees: CAST, rules, rooms: ROOMS, insights: INSIGHTS });
    expect(slots).toHaveLength(0);
  });

  it('완화 제안에 allow-partial-required(준호)가 opens>0 로 포함된다', () => {
    const relax = suggestRelaxations({ attendees: CAST, rules, rooms: ROOMS, insights: INSIGHTS });
    const partial = relax.find((r) => r.kind === 'allow-partial-required' && r.targetId === 'junho');
    expect(partial).toBeDefined();
    expect(partial!.opens).toBeGreaterThan(0);
  });
});

describe('전원 패턴 — 20명 모두 정품질', () => {
  const strictNextWeek = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'];

  it('전원 workHours(start<end) 를 가진다', () => {
    for (const p of ORG) {
      expect(p.workHours.start).toBeLessThan(p.workHours.end);
    }
  });

  it('전원 다음 주 창에서 headline 이 null 이 아니다', () => {
    for (const p of ORG) {
      expect(INSIGHTS[p.id].headline, `${p.name}(${p.id}) headline null`).not.toBeNull();
    }
  });

  it('전원 다음 주(7/13~7/17)에 이벤트 5개 이상이다', () => {
    for (const p of ORG) {
      const n = p.events.filter((e) => strictNextWeek.includes(e.day)).length;
      expect(n, `${p.name}(${p.id}) next-week events=${n}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('faceId 는 전원 존재하며 id 와 매칭된다', () => {
    for (const p of ORG) expect(p.faceId).toBe(p.id);
  });
});

describe('결정성 — 순수 함수', () => {
  it('rankSlots 를 두 번 호출하면 결과가 동일하다', () => {
    const a = setup();
    const b = setup();
    expect(a).toEqual(b);
  });
});

describe('S5 / S6 — 수신 초대 · 응답 각본', () => {
  it('INCOMING_INVITE 는 최민수→나, 해요체 이유가 붙는다', () => {
    expect(INCOMING_INVITE.fromId).toBe('minsu');
    expect(INCOMING_INVITE.reasonsForMe.length).toBeGreaterThanOrEqual(1);
    // 내 줄(회원님)이 첫 줄이고 positive 다.
    expect(INCOMING_INVITE.reasonsForMe[0].tone).toBe('positive');
    expect(INCOMING_INVITE.reasonsForMe[0].text).toContain('회원님');
    // 코드값은 SlotReason 코드 재사용.
    for (const r of INCOMING_INVITE.reasonsForMe) {
      expect(r.text.length).toBeGreaterThan(0);
      expect(['positive', 'tradeoff', 'warning']).toContain(r.tone);
    }
  });

  it('INCOMING_INVITE 슬롯은 이찬·민수 양쪽 캘린더 모두와 실제로 겹치지 않는다', () => {
    const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
      a.start < b.end && b.start < a.end;
    for (const personId of [ME_ID, INCOMING_INVITE.fromId]) {
      const person = ORG.find((p) => p.id === personId)!;
      const clashes = person.events.filter(
        (e) => e.day === INCOMING_INVITE.day && overlaps(e, INCOMING_INVITE),
      );
      expect(clashes, `${person.name}(${personId})의 겹치는 일정: ${clashes.map((e) => e.title).join(', ')}`).toHaveLength(0);
    }
  });

  it('RESPONSE_SCRIPT 는 준호·서연·하늘 순의 3줄이다', () => {
    expect(RESPONSE_SCRIPT).toEqual([
      { afterMs: 3000, personId: 'junho', kind: 'accepted', text: '준호님이 참석해요' },
      { afterMs: 6000, personId: 'seoyeon', kind: 'accepted', text: '서연님이 참석해요' },
      { afterMs: 10000, personId: 'haneul', kind: 'partial', text: '하늘님이 앞 30분 함께해요' },
    ]);
  });
});
