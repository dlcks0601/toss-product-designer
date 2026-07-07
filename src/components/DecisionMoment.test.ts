import { describe, expect, it } from 'vitest';
import { decisionKey, pickAction } from './DecisionMoment';
import type { RelaxationSuggestion } from '../lib/relaxation';

const suggestion = (over: Partial<RelaxationSuggestion>): RelaxationSuggestion => ({
  kind: 'shorten-meeting',
  label: '30분 회의로 줄여요',
  resultSummary: '7월 8일 (수) 오전 10:00이 열려요 · 후보 3개',
  opens: 3,
  bestSlot: null,
  ...over,
});

const conditions = (over: Partial<Parameters<typeof decisionKey>[0]> = {}) => ({
  attendeeIds: ['ichan', 'junho'],
  required: { ichan: true, junho: true },
  duration: 60 as const,
  deadline: 'this-week' as const,
  allowPartialRequiredId: null,
  ...over,
});

describe('decisionKey — 같은 조건 조합에 1회 규칙의 해시', () => {
  it('같은 조건이면 같은 키', () => {
    expect(decisionKey(conditions())).toBe(decisionKey(conditions()));
  });

  it('참석자 순서에는 불변 — 구성이 같으면 같은 조합이다', () => {
    expect(decisionKey(conditions({ attendeeIds: ['junho', 'ichan'] }))).toBe(decisionKey(conditions()));
  });

  it('길이·기한·필수 여부·부분 참석 허용이 바뀌면 다른 키', () => {
    const base = decisionKey(conditions());
    expect(decisionKey(conditions({ duration: 30 }))).not.toBe(base);
    expect(decisionKey(conditions({ deadline: 'next-week' }))).not.toBe(base);
    expect(decisionKey(conditions({ required: { ichan: true, junho: false } }))).not.toBe(base);
    expect(decisionKey(conditions({ allowPartialRequiredId: 'junho' }))).not.toBe(base);
  });

  it('참석자 추가/제거도 다른 키', () => {
    expect(
      decisionKey(conditions({ attendeeIds: ['ichan', 'junho', 'seoyeon'], required: { ichan: true, junho: true, seoyeon: false } })),
    ).not.toBe(decisionKey(conditions()));
  });
});

describe('pickAction — kind별 dispatch 매핑', () => {
  it('extend-deadline은 현재 기한에서 한 단계만 미룬다(시뮬과 같은 사다리)', () => {
    const s = suggestion({ kind: 'extend-deadline' });
    expect(pickAction(s, 'this-week')).toEqual({ type: 'SET_DEADLINE', deadline: 'next-week' });
    expect(pickAction(s, 'next-week')).toEqual({ type: 'SET_DEADLINE', deadline: 'flexible' });
    // flexible은 더 미룰 곳이 없다 — suggestRelaxations가 만들지 않는 조합이지만 방어적으로 null.
    expect(pickAction(s, 'flexible')).toBeNull();
  });

  it('shorten-meeting → SET_DURATION 30', () => {
    expect(pickAction(suggestion({ kind: 'shorten-meeting' }), 'this-week')).toEqual({
      type: 'SET_DURATION',
      duration: 30,
    });
  });

  it('make-optional → SET_REQUIRED(targetId, false)', () => {
    expect(pickAction(suggestion({ kind: 'make-optional', targetId: 'junho' }), 'this-week')).toEqual({
      type: 'SET_REQUIRED',
      id: 'junho',
      required: false,
    });
  });

  it('allow-partial-required → ALLOW_PARTIAL(targetId) — 허락제 부분 참석', () => {
    expect(pickAction(suggestion({ kind: 'allow-partial-required', targetId: 'junho' }), 'this-week')).toEqual({
      type: 'ALLOW_PARTIAL',
      id: 'junho',
    });
  });

  it('대상형 제안에 targetId가 없으면 null(방어)', () => {
    expect(pickAction(suggestion({ kind: 'make-optional' }), 'this-week')).toBeNull();
    expect(pickAction(suggestion({ kind: 'allow-partial-required' }), 'this-week')).toBeNull();
  });
});
