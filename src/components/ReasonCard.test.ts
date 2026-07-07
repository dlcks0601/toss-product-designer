import { describe, expect, it } from 'vitest';
import { badgeFor, summaryLine, REASON_TONE_CLASS } from './ReasonCard';
import type { SlotReason } from '../lib/types';

const positive: SlotReason = {
  code: 'all-required-ok',
  tone: 'positive',
  text: '필수 4명 모두 편하게 참석할 수 있어요',
};
const partial: SlotReason = {
  code: 'optional-partial',
  tone: 'tradeoff',
  text: '박준호님은 뒤 30분만 함께할 수 있어요 — 데일리 스크럼',
  who: 'junho',
};
const warning: SlotReason = {
  code: 'lunch-squeeze',
  tone: 'warning',
  text: '이서연님 점심 여유가 30분뿐이에요',
  who: 'seoyeon',
};

describe('badgeFor', () => {
  it('severity 매핑: good→추천(rec) / tradeoff→일부 아쉬움(ok) / warning→주의(warn)', () => {
    expect(badgeFor('good')).toEqual({ tone: 'rec', label: '추천' });
    expect(badgeFor('tradeoff')).toEqual({ tone: 'ok', label: '일부 아쉬움' });
    expect(badgeFor('warning')).toEqual({ tone: 'warn', label: '주의' });
  });

  it('리스트 1위(recommended)는 tradeoff여도 추천으로 올린다 — S1의 1위(부분 참석 포함)', () => {
    expect(badgeFor('tradeoff', true)).toEqual({ tone: 'rec', label: '추천' });
  });

  it('warning은 recommended로도 덮지 않는다 — 정직 우선', () => {
    expect(badgeFor('warning', true)).toEqual({ tone: 'warn', label: '주의' });
  });
});

describe('summaryLine — summarizeSlot 폴백 방어', () => {
  it('positive가 있으면 summarizeSlot 그대로(첫 positive · 첫 non-positive)', () => {
    expect(summaryLine({ reasons: [positive, partial, warning] }, 4)).toBe(
      `${positive.text} · ${partial.text}`,
    );
  });

  it('positive 부재(허락제 슬롯: all-required-ok 제거됨) → 첫 reason 문장으로 대체한다', () => {
    // summarizeSlot이라면 '필수 4명 모두 편하게 참석할 수 있어요' 폴백이 살아나 모순됐을 케이스.
    const line = summaryLine({ reasons: [partial, warning] }, 4);
    expect(line).toBe(partial.text);
    expect(line).not.toContain('모두');
  });

  it('reasons가 완전히 비면 빈 문자열(카피 조작 금지)', () => {
    expect(summaryLine({ reasons: [] }, 4)).toBe('');
  });
});

describe('REASON_TONE_CLASS', () => {
  it('positive 흰바탕 grey border / tradeoff 파랑 tint / warning warn-bg', () => {
    expect(REASON_TONE_CLASS.positive).toContain('bg-white');
    expect(REASON_TONE_CLASS.positive).toContain('ring-border');
    expect(REASON_TONE_CLASS.tradeoff).toContain('bg-primary-tint');
    expect(REASON_TONE_CLASS.warning).toContain('bg-warn-bg');
    expect(REASON_TONE_CLASS.warning).toContain('text-warn-fg');
  });
});
