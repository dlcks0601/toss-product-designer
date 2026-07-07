'use client';

import { ChevronRight } from 'lucide-react';
import Avatar from './Avatar';
import type { Person } from '../lib/types';

/**
 * 할 일 카드(상시) — "📌 다음 주까지 — 팀 회의 잡기 · 6명".
 * 시나리오 치트 메뉴의 대체품: 누르면 6인 프리필로 셋업에 진입한다(여정 A 입구).
 */
export interface TaskCardProps {
  /** 아바타 줄에 보여줄 핵심 6인 */
  people: Person[];
  onPress: () => void;
}

export default function TaskCard({ people, onPress }: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="pressable flex w-full items-center gap-3 rounded-card bg-white p-4 text-left shadow-[0_2px_12px_rgba(25,31,40,0.06)] ring-1 ring-border/60 transition-shadow hover:shadow-[0_6px_20px_rgba(25,31,40,0.09)]"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF4E0] text-[17px]"
      >
        📌
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-[#B96A0B]">다음 주까지</span>
        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-text-strong">
          팀 회의 잡기 · 6명
        </span>
      </span>
      <span className="flex shrink-0 -space-x-1.5" aria-hidden>
        {people.map((p) => (
          <span key={p.id} className="rounded-full ring-2 ring-white">
            <Avatar person={p} size={24} />
          </span>
        ))}
      </span>
      <ChevronRight size={18} className="shrink-0 text-text-faint" aria-hidden />
    </button>
  );
}
