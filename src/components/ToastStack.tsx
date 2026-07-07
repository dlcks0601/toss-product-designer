'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Mail, PartyPopper } from 'lucide-react';
import type { AppNotification, NotificationKind } from '../lib/types';

/**
 * 토스트 스택 — 알림 스토어의 transient 큐(toasts)를 그린다. 수명(4초 자동 소멸)은
 * 스토어의 몫이고, 여기는 표현만: 데스크톱(lg+) 우하단에서 위로 슬라이드,
 * 모바일 상단에서 드롭. 최대 3장 — 오래된 것은 뒤로 살짝 밀리며 겹친다.
 * 위치 이동은 오버슈트 없는 스프링(350/30), 퇴장은 등장의 역방향. 클릭 시 dismiss.
 */

export const MAX_VISIBLE_TOASTS = 3;

/** 오래된 토스트부터 잘라 마지막 max개만 남긴다(순서 유지 — 마지막이 최신). */
export function visibleToasts<T>(toasts: readonly T[], max: number = MAX_VISIBLE_TOASTS): T[] {
  return toasts.slice(-max);
}

/**
 * 스택 자세 — depth 0이 맨 앞(최신). 뒤로 갈수록 12px씩 밀리고(데스크톱은 위로,
 * 모바일은 아래로) 5%씩 작아지며 은은히 바랜다.
 */
export function stackPose(depth: number, desktop: boolean): { y: number; scale: number; opacity: number } {
  return {
    y: depth === 0 ? 0 : (desktop ? -1 : 1) * depth * 14,
    scale: 1 - depth * 0.05,
    opacity: 1 - depth * 0.13,
  };
}

/** kind → 아이콘·틴트 — 알림 센터(NotificationBell 패널)와 공유하는 단일 소스. */
export const NOTIFICATION_KIND_STYLE: Record<NotificationKind, { Icon: typeof Check; wrap: string }> = {
  response: { Icon: Check, wrap: 'bg-primary-tint text-primary' },
  invite: { Icon: Mail, wrap: 'bg-section text-text-body' },
  confirmed: { Icon: PartyPopper, wrap: 'bg-[#FFF0DC] text-[#B96A0B]' },
};

/** lg(1024px) 기준 — 토스트는 마운트 이후에만 뜨므로 첫 페인트 불일치 걱정이 없다. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

export interface ToastStackProps {
  toasts: AppNotification[];
  onDismiss: (id: string) => void;
}

export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const desktop = useIsDesktop();
  const reduced = !!useReducedMotion();
  const visible = visibleToasts(toasts);
  const count = visible.length;
  // 등장 시작점 — 데스크톱은 아래에서 위로, 모바일은 위에서 드롭
  const enterY = desktop ? 28 : -28;

  return (
    <div
      aria-live="polite"
      className={
        desktop ? 'fixed bottom-6 right-6 z-[60] w-[360px]' : 'fixed inset-x-4 top-4 z-[60] mx-auto max-w-[480px]'
      }
    >
      <AnimatePresence>
        {visible.map((toast, i) => {
          const depth = count - 1 - i;
          const pose = stackPose(depth, desktop);
          const { Icon, wrap } = NOTIFICATION_KIND_STYLE[toast.kind];
          return (
            <motion.div
              key={toast.id}
              role="status"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: enterY, scale: 1 }}
              animate={pose}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: enterY, scale: pose.scale }}
              transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 350, damping: 30 }}
              style={{ zIndex: count - depth, transformOrigin: desktop ? 'bottom center' : 'top center' }}
              onClick={() => onDismiss(toast.id)}
              className={`absolute w-full cursor-pointer select-none ${desktop ? 'bottom-0 right-0' : 'inset-x-0 top-0'}`}
            >
              <div className="flex items-center gap-3 rounded-card bg-white py-3.5 pl-3.5 pr-5 shadow-[0_12px_32px_rgba(25,31,40,0.12),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${wrap}`} aria-hidden>
                  <Icon size={15} strokeWidth={2.4} />
                </span>
                <p className="min-w-0 text-[14px] font-medium leading-[1.45] text-text-strong">{toast.text}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
