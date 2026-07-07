'use client';

import { Bell } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { AppNotification } from '../lib/types';

/**
 * 알림 벨 — 버튼 + 안 읽음 도트(#F04452, 8px)까지가 이 컴포넌트의 몫.
 * 패널(알림 센터) 렌더링은 T12/T19에서 배선한다 — list는 그때를 위한 자리.
 * 도트는 제자리 팝 스프링(500/18, 스케일 전용)으로 나타난다.
 */
export interface NotificationBellProps {
  /** 알림 센터 목록 — 아직 렌더링하지 않는다(T12/T19) */
  list?: AppNotification[];
  unreadCount: number;
  onOpen?: () => void;
}

export default function NotificationBell({ unreadCount, onOpen }: NotificationBellProps) {
  const reduced = !!useReducedMotion();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={unreadCount > 0 ? `알림 — 안 읽음 ${unreadCount}개` : '알림'}
      className="pressable relative flex h-10 w-10 items-center justify-center rounded-full text-text-strong hover:bg-section"
    >
      <Bell size={21} strokeWidth={1.8} aria-hidden />
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            key="unread-dot"
            aria-hidden
            initial={reduced ? { opacity: 0 } : { scale: 0 }}
            animate={reduced ? { opacity: 1 } : { scale: 1 }}
            exit={reduced ? { opacity: 0 } : { scale: 0 }}
            transition={reduced ? { duration: 0.1 } : { type: 'spring', stiffness: 500, damping: 18 }}
            className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full bg-error ring-2 ring-white"
          />
        )}
      </AnimatePresence>
    </button>
  );
}
