'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { HiBell } from 'react-icons/hi';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { NOTIFICATION_KIND_STYLE } from './ToastStack';
import { useIsDesktop } from '../app-state/useIsDesktop';
import type { AppNotification } from '../lib/types';

/**
 * 알림 벨 + 알림 센터 패널 — 헤더의 벨을 탭하면 데스크톱은 드롭다운,
 * 모바일은 바텀시트로 list(적립된 알림)를 펼친다. 여는 순간 onOpen(markAllRead 배선)
 * 이 1회 불려 안 읽음 도트가 사라진다. 비어 있으면 '알림이 없어요'.
 * 도트는 제자리 팝 스프링(500/18, 스케일 전용)으로 나타난다.
 * invite 종류 알림은 표시 전용이 아니라 입구다 — onSelectInvite가 있으면 행 전체가
 * 버튼(셰브런 표시)이 되어 탭 시 패널을 닫고 초대 화면(여정 B)으로 안내한다.
 */

// ── 순수 헬퍼(테스트 대상) ─────────────────────────────────────────

/** 경과 ms → '방금'(1분 미만) / 'N분 전' / 'N시간 전'. 음수(시계 역전)는 방금으로. */
export function relativeTimeLabel(elapsedMs: number): string {
  if (elapsedMs < 60_000) return '방금';
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}

// ── 패널 조각 ──────────────────────────────────────────────────────

function NotificationList({
  list,
  now,
  onSelectInvite,
}: {
  list: AppNotification[];
  now: number;
  /** invite 종류 행을 탭했을 때 — 초대 화면으로 가는 입구(없으면 전 행 표시 전용). */
  onSelectInvite?: (n: AppNotification) => void;
}) {
  if (list.length === 0) {
    return <p className="py-10 text-center text-[13px] text-text-faint">알림이 없어요</p>;
  }
  return (
    <ul className="space-y-0.5">
      {list.map((n) => {
        const { Icon, wrap } = NOTIFICATION_KIND_STYLE[n.kind];
        const icon = (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${wrap}`} aria-hidden>
            <Icon size={15} strokeWidth={2.4} />
          </span>
        );
        const body = (
          <>
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-[1.45] text-text-strong break-keep">{n.text}</p>
            <span className="shrink-0 text-[11px] text-text-faint">{relativeTimeLabel(now - n.at)}</span>
          </>
        );
        // invite 알림은 입구 — 행 전체가 버튼(셰브런)으로 초대 화면을 연다.
        if (n.kind === 'invite' && onSelectInvite) {
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelectInvite(n)}
                className="pressable flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-section"
              >
                {icon}
                {body}
                <ChevronRight size={15} className="shrink-0 text-text-faint" aria-hidden />
              </button>
            </li>
          );
        }
        return (
          <li key={n.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            {icon}
            {body}
          </li>
        );
      })}
    </ul>
  );
}

// ── 본체 ───────────────────────────────────────────────────────────

export interface NotificationBellProps {
  /** 알림 센터 목록(적립분) — 패널이 그린다. */
  list?: AppNotification[];
  unreadCount: number;
  /** 패널이 열리는 순간 1회 — markAllRead 배선용. */
  onOpen?: () => void;
  /** invite 종류 알림을 탭했을 때 — 패널은 스스로 닫힌 뒤 호출한다(초대 화면 배선용). */
  onSelectInvite?: (n: AppNotification) => void;
}

export default function NotificationBell({ list = [], unreadCount, onOpen, onSelectInvite }: NotificationBellProps) {
  const reduced = !!useReducedMotion();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  // invite 행 탭 → 패널을 닫고 나서 배선된 목적지(초대 화면)로 보낸다.
  const selectInvite =
    onSelectInvite &&
    ((n: AppNotification) => {
      setOpen(false);
      onSelectInvite(n);
    });

  const toggle = () => {
    // 여는 순간 읽음 처리 — updater 함수 안이 아니라 이벤트 핸들러에서 호출한다
    // (updater는 렌더 중에 실행될 수 있어, 그 안의 markAllRead가 부모 setState를 렌더 중 유발한다).
    if (!open) onOpen?.();
    setOpen(!open);
  };

  // Esc로 닫기 — 열려 있는 동안만 리스너를 단다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const now = Date.now(); // 렌더 시점 기준 상대시간 — 패널은 열 때마다 다시 렌더된다

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `알림 — 안 읽음 ${unreadCount}개` : '알림'}
        className="pressable relative flex h-10 w-10 items-center justify-center rounded-full text-text-strong hover:bg-section"
      >
        <HiBell size={22} aria-hidden />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="unread-dot"
              aria-hidden
              initial={reduced ? { opacity: 0 } : { scale: 0 }}
              animate={reduced ? { opacity: 1 } : { scale: 1 }}
              exit={reduced ? { opacity: 0 } : { scale: 0 }}
              transition={reduced ? { duration: 0.1 } : { type: 'spring', stiffness: 500, damping: 18 }}
              className="absolute right-[10px] top-[10px] h-2 w-2 rounded-full bg-error"
            />
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* 바깥 탭으로 닫기 — 모바일은 딤, 데스크톱은 투명 오버레이 */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              aria-hidden
              className={`fixed inset-0 z-[70] ${desktop ? '' : 'bg-[rgba(25,31,40,0.35)]'}`}
            />
            {desktop ? (
              // 드롭다운 — 벨 아래 오른쪽 정렬
              <motion.section
                key="panel"
                aria-label="알림 센터"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 350, damping: 30 }}
                style={{ transformOrigin: 'top right' }}
                className="absolute right-0 top-12 z-[80] w-[340px] rounded-card bg-white p-3 shadow-[0_16px_40px_rgba(25,31,40,0.14),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60"
              >
                <h2 className="px-2 pb-1.5 pt-1 text-[14px] font-bold text-text-strong">알림</h2>
                <div className="max-h-[380px] overflow-y-auto">
                  <NotificationList list={list} now={now} onSelectInvite={selectInvite} />
                </div>
              </motion.section>
            ) : (
              // 바텀시트 — 모바일
              <motion.section
                key="sheet"
                aria-label="알림 센터"
                initial={reduced ? { opacity: 0 } : { y: '100%' }}
                animate={reduced ? { opacity: 1 } : { y: 0 }}
                exit={reduced ? { opacity: 0 } : { y: '100%' }}
                transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 350, damping: 32 }}
                className="fixed inset-x-0 bottom-0 z-[80] rounded-t-[20px] bg-white px-4 pt-2 shadow-[0_-8px_32px_rgba(25,31,40,0.14)]"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
              >
                <span aria-hidden className="mx-auto block h-1 w-9 rounded-full bg-border" />
                <h2 className="px-2 pb-1 pt-3 text-[16px] font-bold text-text-strong">알림</h2>
                <div className="max-h-[55dvh] overflow-y-auto">
                  <NotificationList list={list} now={now} onSelectInvite={selectInvite} />
                </div>
              </motion.section>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
