import type { ReactNode } from 'react';

/**
 * 상태 배지 — 추천(rec)/일부 아쉬움(ok)/주의(warn). 항상 텍스트 병기(색만으로
 * 상태를 말하지 않는다). 인터랙션 없음 — 클릭이 필요하면 Chip을 쓴다.
 */
export type BadgeTone = 'rec' | 'ok' | 'warn';

/** tone → 클래스 — 테스트가 계약을 지킨다 (blue50/blue · grey100/grey · warn-bg/warn-fg) */
export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  rec: 'bg-primary-tint text-primary',
  ok: 'bg-section text-text-body',
  warn: 'bg-warn-bg text-warn-fg',
};

export interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

export default function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-md px-1.5 text-[12px] font-semibold ${BADGE_TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
