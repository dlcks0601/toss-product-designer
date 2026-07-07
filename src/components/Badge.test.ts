import { describe, expect, it } from 'vitest';
import { BADGE_TONE_CLASS, type BadgeTone } from './Badge';

describe('BADGE_TONE_CLASS', () => {
  it('rec = blue50 배경 + 파랑 글자', () => {
    expect(BADGE_TONE_CLASS.rec).toBe('bg-primary-tint text-primary');
  });

  it('ok = grey100 배경 + 본문색 글자', () => {
    expect(BADGE_TONE_CLASS.ok).toBe('bg-section text-text-body');
  });

  it('warn = warn-bg 배경 + warn-fg 글자 (대비 보정 토큰)', () => {
    expect(BADGE_TONE_CLASS.warn).toBe('bg-warn-bg text-warn-fg');
  });

  it('세 톤 전부에 클래스가 있다', () => {
    const tones: BadgeTone[] = ['rec', 'ok', 'warn'];
    for (const tone of tones) expect(BADGE_TONE_CLASS[tone]).toBeTruthy();
  });
});
