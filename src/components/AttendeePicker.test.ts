import { describe, it, expect } from 'vitest';
import { confirmLabel, filterPeople, givenName } from './AttendeePicker';
import { ORG } from '../data/world';

describe('givenName — 성을 뗀 호칭', () => {
  it('3글자 이름은 성을 뗀다', () => {
    expect(givenName('박준호')).toBe('준호');
    expect(givenName('이서연')).toBe('서연');
  });
  it('2글자 이름은 그대로', () => {
    expect(givenName('이찬')).toBe('이찬');
  });
});

describe('filterPeople — 이름·역할 부분일치', () => {
  it('빈 질의(공백 포함)는 전원을 돌려준다', () => {
    expect(filterPeople(ORG, '')).toHaveLength(20);
    expect(filterPeople(ORG, '   ')).toHaveLength(20);
  });
  it('이름 부분일치', () => {
    const hits = filterPeople(ORG, '준호');
    expect(hits.map((p) => p.id)).toEqual(['junho']);
  });
  it('역할 부분일치 — 대소문자 무시', () => {
    const hits = filterPeople(ORG, 'designer');
    expect(hits.map((p) => p.id)).toContain('minsu');
    expect(hits.map((p) => p.id)).toContain('gaon');
  });
  it('일치 없음 → 빈 배열', () => {
    expect(filterPeople(ORG, '없는사람')).toEqual([]);
  });
});

describe('confirmLabel — 하단 확정 버튼', () => {
  it('선택 0명 → 안내 문구 + disabled', () => {
    expect(confirmLabel([])).toEqual({ label: '함께할 동료를 선택해주세요', disabled: true });
  });
  it('선택 1명 → "{첫이름}님과 함께해요"', () => {
    expect(confirmLabel(['박준호'])).toEqual({ label: '준호님과 함께해요', disabled: false });
  });
  it('선택 여럿 → "{첫이름}님 외 N명과 함께해요" (첫이름 = 선택 순서 첫 번째)', () => {
    expect(confirmLabel(['박준호', '이서연', '최민수'])).toEqual({
      label: '준호님 외 2명과 함께해요',
      disabled: false,
    });
  });
});
