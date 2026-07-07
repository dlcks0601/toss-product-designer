import { describe, expect, it } from 'vitest';
import {
  activeMitigations,
  adjustedRange,
  bestRoomId,
  fmtDuration,
  mitigationOptions,
  tensionLines,
} from './ConfirmStep';
import type { SlotReason } from '../lib/types';

const reason = (over: Partial<SlotReason>): SlotReason => ({
  code: 'all-required-ok',
  tone: 'positive',
  text: '필수 4명 모두 편하게 참석할 수 있어요',
  ...over,
});

describe('mitigationOptions — 슬롯의 실제 긴장에서만 파생', () => {
  it('after-lunch가 있으면 delayTen을 제안한다', () => {
    const slot = { start: 840, end: 900, reasons: [reason({ code: 'after-lunch', tone: 'warning' })] };
    expect(mitigationOptions(slot)).toEqual({ delayTen: true, fiftyMin: false });
  });
  it('back-to-back이 있고 길이가 50분보다 길면 fiftyMin을 제안한다', () => {
    const slot = { start: 600, end: 660, reasons: [reason({ code: 'back-to-back', tone: 'tradeoff' })] };
    expect(mitigationOptions(slot)).toEqual({ delayTen: false, fiftyMin: true });
  });
  it('back-to-back이라도 30분 회의에는 fiftyMin을 제안하지 않는다(줄이는 배려가 성립 안 함)', () => {
    const slot = { start: 600, end: 630, reasons: [reason({ code: 'back-to-back', tone: 'tradeoff' })] };
    expect(mitigationOptions(slot).fiftyMin).toBe(false);
  });
  it('둘 다 없는 슬롯은 아무것도 제안하지 않는다', () => {
    const slot = { start: 600, end: 660, reasons: [reason({})] };
    expect(mitigationOptions(slot)).toEqual({ delayTen: false, fiftyMin: false });
  });
});

describe('activeMitigations — 토글 잔존 상태와 슬롯 맥락의 교집합', () => {
  it('이 슬롯이 제안하지 않는 완화는 토글이 켜져 있어도 무효다', () => {
    const slot = { start: 600, end: 660, reasons: [reason({})] }; // 아무 긴장 없음
    expect(activeMitigations(slot, { delayTen: true, fiftyMin: true })).toEqual({
      delayTen: false,
      fiftyMin: false,
    });
  });
  it('제안하는 완화는 토글 상태 그대로 통과한다', () => {
    const slot = { start: 840, end: 900, reasons: [reason({ code: 'after-lunch', tone: 'warning' })] };
    expect(activeMitigations(slot, { delayTen: true, fiftyMin: true })).toEqual({
      delayTen: true,
      fiftyMin: false,
    });
  });
});

describe('adjustedRange — 완화 반영 시간', () => {
  const slot = { start: 840, end: 900 }; // 14:00–15:00

  it('완화 없음 — 원래 시간 그대로', () => {
    expect(adjustedRange(slot, { delayTen: false, fiftyMin: false })).toEqual({ start: 840, end: 900 });
  });
  it('delayTen — 시작·끝 모두 +10분', () => {
    expect(adjustedRange(slot, { delayTen: true, fiftyMin: false })).toEqual({ start: 850, end: 910 });
  });
  it('fiftyMin — 시작부터 50분으로 마친다', () => {
    expect(adjustedRange(slot, { delayTen: false, fiftyMin: true })).toEqual({ start: 840, end: 890 });
  });
  it('둘 다 — 10분 늦춘 시작에서 50분', () => {
    expect(adjustedRange(slot, { delayTen: true, fiftyMin: true })).toEqual({ start: 850, end: 900 });
  });
});

describe('tensionLines — 긴장 라인만 1~2줄 재노출', () => {
  it('positive는 거르고 비positive만 남긴다', () => {
    const reasons = [
      reason({}),
      reason({ code: 'back-to-back', tone: 'tradeoff', text: 'A' }),
      reason({ code: 'after-lunch', tone: 'warning', text: 'B' }),
    ];
    expect(tensionLines(reasons).map((r) => r.text)).toEqual(['A', 'B']);
  });
  it('최대 2줄 — 순서는 원본 그대로', () => {
    const reasons = [
      reason({ code: 'back-to-back', tone: 'tradeoff', text: 'A' }),
      reason({ code: 'lunch-squeeze', tone: 'warning', text: 'B' }),
      reason({ code: 'late-start', tone: 'tradeoff', text: 'C' }),
    ];
    expect(tensionLines(reasons).map((r) => r.text)).toEqual(['A', 'B']);
  });
  it('전부 positive면 빈 배열(요약 카드에 긴장 라인 없음)', () => {
    expect(tensionLines([reason({}), reason({ code: 'before-lunch-bonus' })])).toEqual([]);
  });
});

describe('bestRoomId — 딱 맞는(정원 여유 최소) 방', () => {
  const rooms = [
    { id: 'big', capacity: 10 },
    { id: 'mid', capacity: 8 },
    { id: 'small', capacity: 4 },
  ];
  it('headcount 6이면 여유 2의 mid를 추천한다(small은 정원 미달)', () => {
    expect(bestRoomId(rooms, 6)).toBe('mid');
  });
  it('여유 동률이면 목록 앞쪽을 추천한다', () => {
    expect(bestRoomId([{ id: 'a', capacity: 6 }, { id: 'b', capacity: 6 }], 6)).toBe('a');
  });
  it('수용 가능한 방이 없으면 null(화상 옵션이 추천을 받는다)', () => {
    expect(bestRoomId(rooms, 11)).toBeNull();
    expect(bestRoomId([], 4)).toBeNull();
  });
});

describe('fmtDuration', () => {
  it.each([
    [30, '30분'],
    [50, '50분'],
    [60, '1시간'],
    [70, '1시간 10분'],
    [90, '1시간 30분'],
  ])('%i분 → %s', (minutes, label) => {
    expect(fmtDuration(minutes)).toBe(label);
  });
});
