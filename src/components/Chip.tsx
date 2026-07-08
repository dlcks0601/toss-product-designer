'use client';

import type { ReactNode } from 'react';

/**
 * 선택형 필 칩 — 기한(이번 주/다음 주/여유)·길이(30분/1시간…) 선택에 쓴다.
 * 선택 시 primary 틴트 + 파랑 글자, 평시 grey100 + 본문색. 프레스 스쿼시 공용.
 * tint를 주면 선택 색이 primary 대신 그 색 — 일정 종류 칩(캘린더 카드 색과 단일 소스).
 */
export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  /** 선택 시 색 오버라이드 — 종류색 칩용(bg + 글자색). */
  tint?: { bg: string; text: string };
  children: ReactNode;
}

export default function Chip({ selected = false, onClick, tint, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={selected && tint ? { backgroundColor: tint.bg, color: tint.text } : undefined}
      className={`pressable inline-flex h-9 items-center rounded-full px-4 text-[14px] transition-colors ${
        selected
          ? tint
            ? 'font-semibold'
            : 'bg-primary-tint font-semibold text-primary'
          : 'bg-section font-medium text-text-body hover:bg-border/70'
      }`}
    >
      {children}
    </button>
  );
}
