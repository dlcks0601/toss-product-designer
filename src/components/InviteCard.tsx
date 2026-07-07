'use client';

import { ChevronRight } from 'lucide-react';
import Avatar from './Avatar';
import type { Person } from '../lib/types';

/**
 * 받은 초대 카드 — 캘린더 상단의 여정 B 입구.
 * "민수님이 보낸 초대 · 목 7월 9일 오후 2:00" + 빨간 점 `응답 대기` 배지.
 * 초대는 캘린더 안에도 고스트 이벤트로 산다(HomeCalendar) — 이 카드는 지름길이다.
 */
export interface InviteCardProps {
  /** 보낸 사람(민수) — 아바타용 */
  from: Person;
  /** 호칭 라벨('민수') — 응답 토스트의 '준호님' 톤과 맞춘 성 뗀 이름 */
  fromLabel: string;
  /** '목 7월 9일 오후 2:00' 형태의 시각 라벨 */
  dateLabel: string;
  onPress: () => void;
}

export default function InviteCard({ from, fromLabel, dateLabel, onPress }: InviteCardProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="pressable flex w-full items-center gap-3 rounded-card bg-white p-4 text-left shadow-[0_2px_12px_rgba(25,31,40,0.06)] ring-1 ring-border/60 transition-shadow hover:shadow-[0_6px_20px_rgba(25,31,40,0.09)]"
    >
      <span className="relative shrink-0" aria-hidden>
        <Avatar person={from} size={40} />
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[10px] shadow-[0_1px_3px_rgba(25,31,40,0.15)]">
          📩
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-primary">{fromLabel}님이 보낸 초대</span>
        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-text-strong">
          {dateLabel}
        </span>
      </span>
      <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-md bg-[#FDEDEE] px-2 text-[12px] font-semibold text-error">
        <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden />
        응답 대기
      </span>
      <ChevronRight size={18} className="shrink-0 text-text-faint" aria-hidden />
    </button>
  );
}
