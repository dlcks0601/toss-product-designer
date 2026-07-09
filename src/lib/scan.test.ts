import { describe, it, expect } from 'vitest';
import {
  SCAN_HOLD_MS,
  SCAN_MAX_INTERVAL_MS,
  SCAN_MIN_INTERVAL_MS,
  SCAN_START_MS,
  buildScanSteps,
  finalScanLine,
  scanIntervalMs,
  scanTimeline,
} from './scan';
import type { PersonInsights } from './types';

const insightOf = (id: string): PersonInsights => ({
  offsiteWeekdays: [],
  recurring: [],
  lunchRhythm: null,
  headline: null,
  scanLine: `${id}님의 일정을 확인했어요`,
});
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
const insightsFor = (ids: { id: string }[]) =>
  Object.fromEntries(ids.map((a) => [a.id, insightOf(a.id)]));

describe('scanIntervalMs — 인원수 → 점등 간격', () => {
  it('6인 이하는 최대 간격 200ms(음악적 리듬)', () => {
    expect(scanIntervalMs(1)).toBe(200);
    expect(scanIntervalMs(6)).toBe(200);
  });

  it('예산(1200ms)을 인원수로 나눈다 — 8인 → 150ms', () => {
    expect(scanIntervalMs(8)).toBe(150);
  });

  it('최소 120ms 아래로는 내려가지 않는다', () => {
    expect(scanIntervalMs(10)).toBe(120);
    expect(scanIntervalMs(20)).toBe(SCAN_MIN_INTERVAL_MS);
  });

  it('0 이하 인원은 최대 간격으로 방어', () => {
    expect(scanIntervalMs(0)).toBe(SCAN_MAX_INTERVAL_MS);
  });
});

describe('buildScanSteps — 순서·문장·압축', () => {
  it('6인 이하: 전원 개별 scanLine, 참석자 순서 유지', () => {
    const cast = people(6);
    const steps = buildScanSteps(cast, insightsFor(cast));
    expect(steps.map((s) => s.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
    expect(steps.map((s) => s.line)).toEqual(cast.map((p) => `${p.id}님의 일정을 확인했어요`));
  });

  it('6인 초과: 앞 5명 개별 + 나머지는 요약 한 줄로 압축(아바타 스텝 수는 전원 유지)', () => {
    const cast = people(8);
    const steps = buildScanSteps(cast, insightsFor(cast));
    expect(steps).toHaveLength(8);
    expect(steps.slice(0, 5).map((s) => s.line)).toEqual(
      ['p0', 'p1', 'p2', 'p3', 'p4'].map((id) => `${id}님의 일정을 확인했어요`),
    );
    expect(steps.slice(5).map((s) => s.line)).toEqual(
      Array(3).fill('나머지 3명의 일정도 확인했어요'),
    );
  });

  it('경계 6인은 압축하지 않는다', () => {
    const cast = people(6);
    const steps = buildScanSteps(cast, insightsFor(cast));
    expect(steps[5].line).toBe('p5님의 일정을 확인했어요');
  });

  it('insights에 없는 id는 빈 문장으로 방어(크래시 없음)', () => {
    const steps = buildScanSteps([{ id: 'ghost' }], {});
    expect(steps).toEqual([{ id: 'ghost', line: '' }]);
  });
});

describe('finalScanLine — 회의 길이 반영', () => {
  it('60분(기본 여정) → 바인딩 문장 그대로', () => {
    expect(finalScanLine(60)).toBe('모두 가능한 1시간을 찾았어요');
  });
  it('30분 / 90분도 길이에 맞는 문장', () => {
    expect(finalScanLine(30)).toBe('모두 가능한 30분을 찾았어요');
    expect(finalScanLine(90)).toBe('모두 가능한 1시간 30분을 찾았어요');
  });
});

describe('scanTimeline — 전체 안무', () => {
  it('기본 캐스트 6인: 점등 120·320·…·1120, 마무리 1320, 완료 1770(1.2~1.8s 창 안)', () => {
    const t = scanTimeline(6);
    expect(t.intervalMs).toBe(200);
    expect(t.lightAt).toEqual([120, 320, 520, 720, 920, 1120]);
    expect(t.finaleAt).toBe(1320);
    expect(t.doneAt).toBe(1770);
    expect(t.doneAt).toBeGreaterThanOrEqual(1200);
    expect(t.doneAt).toBeLessThanOrEqual(1800);
  });

  it('점등 시각은 단조 증가하고 마무리는 마지막 점등에서 한 박자 뒤', () => {
    for (const n of [2, 6, 8, 12]) {
      const t = scanTimeline(n);
      for (let i = 1; i < t.lightAt.length; i += 1) {
        expect(t.lightAt[i] - t.lightAt[i - 1]).toBe(t.intervalMs);
      }
      expect(t.finaleAt).toBe(t.lightAt[n - 1] + t.intervalMs);
      expect(t.doneAt).toBe(t.finaleAt + SCAN_HOLD_MS);
    }
  });

  it('인원이 많아도 점등 총량은 예산 근처를 유지한다(간격 압축, 최소 120ms)', () => {
    const t = scanTimeline(10);
    expect(t.intervalMs).toBe(120);
    expect(t.finaleAt - SCAN_START_MS).toBe(10 * 120); // = 예산(1200ms) 그대로
  });

  it('0인 방어 — 점등 없이 정착 후 바로 마무리', () => {
    const t = scanTimeline(0);
    expect(t.lightAt).toEqual([]);
    expect(t.finaleAt).toBe(SCAN_START_MS);
  });
});
