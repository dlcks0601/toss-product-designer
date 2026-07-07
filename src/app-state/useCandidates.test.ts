import { describe, expect, it } from 'vitest';
import { buildAttendees, computeCandidates, VISIBLE_COUNT } from './useCandidates';
import { DEFAULT_CAST, ME_ID } from '../data/world';

/** S1 기본 6인(필수 4 + 선택 2) required 맵. */
function defaultInput(overrides?: Partial<Parameters<typeof computeCandidates>[0]>) {
  const required: Record<string, boolean> = {};
  for (const id of DEFAULT_CAST.requiredIds) required[id] = true;
  for (const id of DEFAULT_CAST.optionalIds) required[id] = false;
  return {
    attendeeIds: [...DEFAULT_CAST.requiredIds, ...DEFAULT_CAST.optionalIds],
    required,
    duration: 60 as const,
    deadline: 'next-week' as const,
    allowPartialRequiredId: null,
    ...overrides,
  };
}

describe('buildAttendees', () => {
  it('required 맵대로 attendanceType을 매기고 주최자에 isOrganizer를 단다', () => {
    const attendees = buildAttendees([ME_ID, 'haneul'], { [ME_ID]: true, haneul: false });
    expect(attendees).toHaveLength(2);
    expect(attendees[0]).toMatchObject({ id: ME_ID, attendanceType: 'required', isOrganizer: true });
    expect(attendees[1]).toMatchObject({ id: 'haneul', attendanceType: 'optional' });
    expect(attendees[1].isOrganizer).toBeUndefined();
  });

  it('ORG에 없는 id(딥링크 오염)는 조용히 건너뛴다', () => {
    const attendees = buildAttendees([ME_ID, 'ghost-9'], { [ME_ID]: true, 'ghost-9': true });
    expect(attendees.map((a) => a.id)).toEqual([ME_ID]);
  });
});

describe('computeCandidates — S1 (기본 6인, 다음 주까지, 1시간)', () => {
  const result = computeCandidates(defaultInput());

  it('후보 9개, 표시 5개(상위 slice)', () => {
    expect(result.slots).toHaveLength(9);
    expect(result.visible).toHaveLength(VISIBLE_COUNT);
    expect(result.visible.map((s) => s.id)).toEqual(result.slots.slice(0, 5).map((s) => s.id));
  });

  it('1위는 수 7/15 오전 10:00 — 하늘 앞 30분 부분 참석 포함', () => {
    const top = result.visible[0];
    expect(top.id).toBe('2026-07-15T600');
    expect(top.partials).toEqual([
      { attendeeId: 'haneul', part: 'front', minutes: 30, conflictTitle: '콘텐츠 리뷰' },
    ]);
  });

  it('결정 모먼트는 아니다(표시 후보에 non-warning 존재)', () => {
    expect(result.needsDecision).toBe(false);
  });

  it('insights는 참석자만 키로 갖는다', () => {
    expect(Object.keys(result.insights).sort()).toEqual([...defaultInput().attendeeIds].sort());
  });
});

describe('computeCandidates — 조건 변화', () => {
  it('이번 주 안에 → 후보 0 → needsDecision(빈 상태/결정 모먼트 트리거)', () => {
    const result = computeCandidates(defaultInput({ deadline: 'this-week' }));
    expect(result.slots).toHaveLength(0);
    expect(result.visible).toHaveLength(0);
    expect(result.needsDecision).toBe(true);
  });

  it('90분 → 후보 4개 전부 warning → needsDecision', () => {
    const result = computeCandidates(defaultInput({ duration: 90 }));
    expect(result.slots).toHaveLength(4);
    expect(result.visible.every((s) => s.severity === 'warning')).toBe(true);
    expect(result.needsDecision).toBe(true);
  });

  it('허락제(준호 부분 참석) — 이번 주에 슬롯이 열리고 all-required-ok 카피가 없다', () => {
    const result = computeCandidates(
      defaultInput({ deadline: 'this-week', allowPartialRequiredId: 'junho' }),
    );
    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      expect(slot.partials.some((p) => p.attendeeId === 'junho')).toBe(true);
      // rankSlots가 '필수 N명 모두' 카피를 제거했다 — summaryLine 방어(ReasonCard)의 전제.
      expect(slot.reasons.some((r) => r.code === 'all-required-ok')).toBe(false);
    }
  });
});
