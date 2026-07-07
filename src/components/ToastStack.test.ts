import { describe, expect, it } from 'vitest';
import { MAX_VISIBLE_TOASTS, stackPose, visibleToasts } from './ToastStack';

describe('visibleToasts', () => {
  it('3개 이하는 그대로', () => {
    expect(visibleToasts([])).toEqual([]);
    expect(visibleToasts(['a'])).toEqual(['a']);
    expect(visibleToasts(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('4개 이상이면 오래된 것부터 잘라 마지막 3개만 (순서 유지 — 마지막이 최신)', () => {
    expect(visibleToasts(['a', 'b', 'c', 'd'])).toEqual(['b', 'c', 'd']);
    expect(visibleToasts(['a', 'b', 'c', 'd', 'e'])).toEqual(['c', 'd', 'e']);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const src = ['a', 'b', 'c', 'd'];
    visibleToasts(src);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
  });

  it('max 기본값은 3', () => {
    expect(MAX_VISIBLE_TOASTS).toBe(3);
  });
});

describe('stackPose', () => {
  it('depth 0(최신)은 제자리 — 원치수·불투명', () => {
    expect(stackPose(0, true)).toEqual({ y: 0, scale: 1, opacity: 1 });
    expect(stackPose(0, false)).toEqual({ y: 0, scale: 1, opacity: 1 });
  });

  it('데스크톱은 뒤로 갈수록 위로(-y), 모바일은 아래로(+y) 밀린다', () => {
    expect(stackPose(1, true).y).toBeLessThan(0);
    expect(stackPose(1, false).y).toBeGreaterThan(0);
  });

  it('깊어질수록 살짝 작아지고 바랜다 (최대 depth 2까지 가시)', () => {
    const front = stackPose(0, true);
    const mid = stackPose(1, true);
    const back = stackPose(2, true);
    expect(mid.scale).toBeLessThan(front.scale);
    expect(back.scale).toBeLessThan(mid.scale);
    expect(mid.opacity).toBeLessThan(front.opacity);
    expect(back.opacity).toBeLessThan(mid.opacity);
    expect(back.opacity).toBeGreaterThan(0.5); // 뒤쪽도 존재감은 남긴다
  });
});
