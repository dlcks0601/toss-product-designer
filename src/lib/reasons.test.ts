import { describe, it, expect } from 'vitest';
import { formatReasons, summarizeSlot, slotSeverity, josa } from './reasons';
import type { Attendee, ScoreEffect, SlotReason } from './types';

const attendee = (id: string, name: string, type: Attendee['attendanceType'] = 'required'): Attendee => ({
  id, name, role: 'PO', faceId: 'f', attendanceType: type, workHours: { start: 540, end: 1080 }, events: [],
});
const people = [
  attendee('a1', '김지은'), attendee('a2', '박서준'), attendee('a3', '이하늘'), attendee('a4', '최민호'),
  attendee('o1', '정하늘', 'optional'), attendee('o2', '유나', 'optional'),
];

describe('josa', () => {
  it('받침 있으면 앞 조사(이/은), 없으면 뒤 조사(가/는)', () => {
    expect(josa('지은', '이', '가')).toBe('이');   // 은: 받침 있음
    expect(josa('민호', '이', '가')).toBe('가');   // 호: 받침 없음
    expect(josa('지은', '은', '는')).toBe('은');
    expect(josa('민호', '은', '는')).toBe('는');
  });
  it('한글이 아니면 받침 없음으로 취급', () => {
    expect(josa('Kim', '이', '가')).toBe('가');
  });
});

describe('formatReasons — 코드→해요체', () => {
  it('all-required-ok는 필수 인원 합산 한 줄', () => {
    const four = people.slice(0, 4);
    const reasons = formatReasons([{ code: 'all-required-ok', delta: 0 }], four);
    expect(reasons).toHaveLength(1);
    expect(reasons[0].text).toBe('필수 4명 모두 편하게 참석할 수 있어요');
    expect(reasons[0].tone).toBe('positive');
  });
  it('optional-ok는 M명 중 K명', () => {
    const e: ScoreEffect = { code: 'optional-ok', delta: 7, data: { ok: 2, total: 3 } };
    expect(formatReasons([e], people)[0].text).toBe('선택 참석자 3명 중 2명이 함께할 수 있어요');
  });
  it('optional-unavailable은 이름을 넣어 준다', () => {
    const r = formatReasons([{ code: 'optional-unavailable', delta: 0, who: 'o2' }], people)[0];
    expect(r.text).toBe('유나님은 이 시간이 어려워요');
    expect(r.tone).toBe('tradeoff');
    expect(r.who).toBe('o2');
  });
  it('offsite-day', () => {
    const r = formatReasons([{ code: 'offsite-day', delta: -8, who: 'a2' }], people)[0];
    expect(r.text).toBe('박서준님 외근 날이에요 — 화상으로 합류할 수 있어요');
    expect(r.tone).toBe('warning');
  });
  it('back-to-back 직전/직후', () => {
    const before = formatReasons([{ code: 'back-to-back', delta: -6, who: 'a1', data: { side: 'before', title: 'X' } }], people)[0];
    const after = formatReasons([{ code: 'back-to-back', delta: -6, who: 'a1', data: { side: 'after', title: 'X' } }], people)[0];
    expect(before.text).toBe('김지은님은 직전에 다른 일정이 있어요');
    expect(after.text).toBe('김지은님은 직후에 다른 일정이 있어요');
  });
  it('focus-overlap', () => {
    expect(formatReasons([{ code: 'focus-overlap', delta: -5, who: 'a3' }], people)[0].text).toBe('이하늘님의 집중 시간과 겹쳐요');
  });
  it('late-start / no-room 고정 문구', () => {
    expect(formatReasons([{ code: 'late-start', delta: -4 }], people)[0].text).toBe('하루가 끝나갈 무렵이에요');
    expect(formatReasons([{ code: 'no-room', delta: -7 }], people)[0].text).toBe('비어 있는 회의실이 없어요 — 화상은 가능해요');
  });
  it('after-lunch은 리듬 시작 시각(rhythmStart)을 넣어 준다', () => {
    const r = formatReasons([{ code: 'after-lunch', delta: -12, who: 'a1', data: { rhythmStart: 780, rhythmEnd: 820 } }], people)[0];
    expect(r.text).toBe('김지은님은 보통 오후 1:00쯤 점심을 먹어요 — 직후 시작은 나른할 수 있어요');
    expect(r.tone).toBe('warning');
  });
  it('before-lunch-bonus는 이름 없는 고정 문구', () => {
    const r = formatReasons([{ code: 'before-lunch-bonus', delta: 4 }], people)[0];
    expect(r.text).toBe('점심 직전이라 산뜻하게 끝나요');
    expect(r.tone).toBe('positive');
  });
  it('lunch-squeeze는 이름과 남은 여유(gap)를 넣어 준다', () => {
    const r = formatReasons([{ code: 'lunch-squeeze', delta: -8, who: 'a2', data: { gap: 30 } }], people)[0];
    expect(r.text).toBe('박서준님 점심 여유가 30분뿐이에요');
    expect(r.tone).toBe('warning');
  });
});

describe('slotSeverity', () => {
  const r = (tone: SlotReason['tone']): SlotReason => ({ code: 'late-start', tone, text: '' });
  it('warning이 하나라도 있으면 warning', () => {
    expect(slotSeverity([r('positive'), r('tradeoff'), r('warning')])).toBe('warning');
  });
  it('warning 없고 tradeoff 있으면 tradeoff', () => {
    expect(slotSeverity([r('positive'), r('tradeoff')])).toBe('tradeoff');
  });
  it('positive만 있으면 good', () => {
    expect(slotSeverity([r('positive')])).toBe('good');
  });
});

describe('summarizeSlot', () => {
  const R = (tone: SlotReason['tone'], text: string): SlotReason => ({ code: 'late-start', tone, text });
  it('첫 positive + 첫 non-positive를 " · "로 잇는다', () => {
    const reasons = [R('positive', '필수 2명 모두 편하게 참석할 수 있어요'), R('warning', '비어 있는 회의실이 없어요 — 화상은 가능해요')];
    expect(summarizeSlot(reasons, 2)).toBe('필수 2명 모두 편하게 참석할 수 있어요 · 비어 있는 회의실이 없어요 — 화상은 가능해요');
  });
  it('non-positive가 없으면 positive만', () => {
    expect(summarizeSlot([R('positive', '필수 4명 모두 편하게 참석할 수 있어요')], 4)).toBe('필수 4명 모두 편하게 참석할 수 있어요');
  });
});

// Task 6 — 부분 참석 문장.
it.todo('optional-partial → "하늘님은 앞 30분만 함께할 수 있어요 — 11시에 다른 회의" (Task 6)');
