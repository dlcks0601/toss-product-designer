'use client';

import type { ReactNode } from 'react';

/**
 * 선택형 필 칩 — 기한(이번 주/다음 주/여유)·길이(30분/1시간…) 선택에 쓴다.
 * 선택 시 primary 틴트 + 파랑 글자, 평시 grey100 + 본문색. 프레스 스쿼시 공용.
 */
export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export default function Chip({ selected = false, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`pressable inline-flex h-9 items-center rounded-full px-4 text-[14px] transition-colors ${
        selected
          ? 'bg-primary-tint font-semibold text-primary'
          : 'bg-section font-medium text-text-body hover:bg-border/70'
      }`}
    >
      {children}
    </button>
  );
}
