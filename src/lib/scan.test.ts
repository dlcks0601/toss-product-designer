import { describe, it, expect } from 'vitest';
import { SCAN_FINALE_MS, SCAN_STEP_MS, finalScanLine, scanSteps, scanTimeline } from './scan';

describe('scanSteps — 3스텝 고정 카피', () => {
  it('스텝은 항상 3개: 읽기 → 피하기 → 고르기', () => {
    expect(scanSteps(6).map((s) => s.title)).toEqual([
      '캘린더 읽는 중',
      '바쁜 시간 피하는 중',
      '좋은 시간 고르는 중',
    ]);
  });

  it('첫 스텝 설명에만 인원수가 실린다', () => {
    const steps = scanSteps(6);
    expect(steps[0].desc).toBe('6명의 다음 주를 펼쳐 보고 있어요');
    expect(steps[1].desc).toBe('점심 리듬과 외근, 휴가까지 살펴요');
    expect(steps[2].desc).toBe('모두에게 편한 순서로 줄을 세워요');
    expect(scanSteps(3)[0].desc).toBe('3명의 다음 주를 펼쳐 보고 있어요');
  });

  it("카피 계약 — '모두를 생각한' 류의 수사를 쓰지 않는다", () => {
    const all = scanSteps(6)
      .flatMap((s) => [s.title, s.desc])
      .join(' ');
    expect(all).not.toContain('모두를 생각한');
  });
});

describe('scanTimeline — 스텝 박자와 종료 시각', () => {
  it('스텝은 1.9초 간격으로 내려간다(첫 스텝은 0)', () => {
    expect(scanTimeline(3).stepAt).toEqual([0, SCAN_STEP_MS, SCAN_STEP_MS * 2]);
  });

  it('마무리 문장은 마지막 스텝이 끝나는 순간, onDone은 그 한 박자 뒤', () => {
    const t = scanTimeline(3);
    expect(t.finaleAt).toBe(SCAN_STEP_MS * 3);
    expect(t.doneAt).toBe(SCAN_STEP_MS * 3 + SCAN_FINALE_MS);
  });

  it('3스텝 기준 총 7.0초 — 컨셉 모먼트의 허용 창(6~8초) 안', () => {
    const t = scanTimeline(3);
    expect(t.doneAt).toBe(7000);
    expect(t.doneAt).toBeGreaterThanOrEqual(6000);
    expect(t.doneAt).toBeLessThanOrEqual(8000);
  });

  it('0스텝 방어 — 즉시 마무리 비트로', () => {
    const t = scanTimeline(0);
    expect(t.stepAt).toEqual([]);
    expect(t.finaleAt).toBe(0);
    expect(t.doneAt).toBe(SCAN_FINALE_MS);
  });
});

describe('finalScanLine — 회의 길이에 맞춘 마무리 문장', () => {
  it('60분(기본 여정) → 1시간', () => {
    expect(finalScanLine(60)).toBe('모두 가능한 1시간을 찾았어요');
  });
  it('30분 / 90분도 길이에 맞는 문장', () => {
    expect(finalScanLine(30)).toBe('모두 가능한 30분을 찾았어요');
    expect(finalScanLine(90)).toBe('모두 가능한 1시간 30분을 찾았어요');
  });
});
