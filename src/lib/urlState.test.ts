import { describe, it, expect } from 'vitest';
import { serializeState, parseState } from './urlState';
import type { ParsedUrlState } from './urlState';

describe('urlState — 라운드트립', () => {
  it('parse(serialize(x)) === x (모든 필드 채움)', () => {
    const x: ParsedUrlState = {
      attendees: [
        { id: 'ichan', required: true },
        { id: 'junho', required: true },
        { id: 'seoyeon', required: false },
      ],
      duration: 90,
      deadline: 'flexible',
      step: 'confirm',
      selectedSlotId: '2026-07-15T600',
      allowPartialFor: 'junho',
    };
    expect(parseState(serializeState(x))).toEqual(x);
  });

  it('선택 필드 null이면 slot·ap 생략하고 라운드트립', () => {
    const x: ParsedUrlState = {
      attendees: [{ id: 'ichan', required: true }],
      duration: 60,
      deadline: 'next-week',
      step: 'find',
      selectedSlotId: null,
      allowPartialFor: null,
    };
    const qs = serializeState(x);
    expect(qs).not.toContain('slot=');
    expect(qs).not.toContain('ap=');
    expect(parseState(qs)).toEqual(x);
  });

  it('빈 참석자도 라운드트립', () => {
    const x: ParsedUrlState = {
      attendees: [], duration: 60, deadline: 'next-week', step: 'home',
      selectedSlotId: null, allowPartialFor: null,
    };
    expect(parseState(serializeState(x))).toEqual(x);
  });
});

describe('urlState — serialize 형식', () => {
  it('organizerId를 p의 맨 앞으로 올린다', () => {
    const qs = serializeState({
      attendees: [
        { id: 'a', required: true },
        { id: 'org', required: true },
        { id: 'b', required: false },
      ],
      organizerId: 'org',
    });
    const p = new URLSearchParams(qs).get('p');
    expect(p).toBe('org.r,a.r,b.o');
  });

  it('required는 .r, optional은 .o로 인코딩', () => {
    const qs = serializeState({ attendees: [{ id: 'x', required: true }, { id: 'y', required: false }] });
    expect(new URLSearchParams(qs).get('p')).toBe('x.r,y.o');
  });

  it('deadline은 tw|nw|fx로 축약', () => {
    expect(serializeState({ deadline: 'this-week' })).toContain('dl=tw');
    expect(serializeState({ deadline: 'next-week' })).toContain('dl=nw');
    expect(serializeState({ deadline: 'flexible' })).toContain('dl=fx');
  });
});

describe('urlState — parse 안전 기본값', () => {
  it('빈 문자열 → 홈/빈 참석자 기본값', () => {
    expect(parseState('')).toEqual({
      attendees: [], duration: 60, deadline: 'next-week', step: 'home',
      selectedSlotId: null, allowPartialFor: null,
    });
  });

  it('완전 이상값 → 기본값으로 강등', () => {
    const out = parseState('p=&d=abc&dl=zz&s=nonsense&slot=&ap=');
    expect(out.attendees).toEqual([]);
    expect(out.duration).toBe(60);
    expect(out.deadline).toBe('next-week');
    expect(out.step).toBe('home');
    expect(out.selectedSlotId).toBeNull();
    expect(out.allowPartialFor).toBeNull();
  });

  it('선행 ? 를 허용', () => {
    const out = parseState('?p=ichan.r&d=30&dl=tw&s=setup');
    expect(out.attendees).toEqual([{ id: 'ichan', required: true }]);
    expect(out.duration).toBe(30);
    expect(out.deadline).toBe('this-week');
    expect(out.step).toBe('setup');
  });

  it('망가진 토큰은 버리고 유효 토큰만 남긴다', () => {
    const out = parseState('p=good.r,bad,also.x,dup.r,dup.o');
    expect(out.attendees).toEqual([{ id: 'good', required: true }, { id: 'dup', required: true }]);
  });

  it('잘못된 파라미터 파싱 중 예외가 나도 기본값', () => {
    expect(parseState('%')).toEqual({
      attendees: [], duration: 60, deadline: 'next-week', step: 'home',
      selectedSlotId: null, allowPartialFor: null,
    });
  });
});
