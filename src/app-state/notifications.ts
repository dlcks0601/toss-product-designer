/**
 * 알림 스토어 — 확정 후 RESPONSE_SCRIPT를 재생해 홈 화면 토스트/알림 센터를 채운다.
 *
 * 상태 로직(push·dismiss·markAllRead·4초 자동 소멸)은 React와 무관한 순수 스토어
 * (createNotificationStore)에 있다 — vi.useFakeTimers()로 React 렌더 없이 검증한다.
 * useNotifications()는 그 스토어를 구독하는 얇은 React 어댑터일 뿐이다.
 *
 * setTimeout 사용은 여기서는 허용된다(UI 레이어) — 엔진 순수성 규칙(Date.now/Math.random 금지)은
 * src/lib 전용이다. id는 카운터로만 만든다(Math.random 금지 — 결정성).
 */
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AppNotification } from '../lib/types';
import { RESPONSE_SCRIPT } from '../data/world';

const TOAST_LIFETIME_MS = 4000;

export interface NotificationsSnapshot {
  list: AppNotification[];
  toasts: AppNotification[];
  unreadCount: number;
}

export interface NotificationStore {
  getSnapshot(): NotificationsSnapshot;
  subscribe(listener: () => void): () => void;
  push(n: AppNotification): void;
  dismiss(id: string): void;
  markAllRead(): void;
}

/**
 * 순수 알림 스토어 — 토스트(transient 오버레이 큐)와 알림 센터(list, 영구 적립)를 관리한다.
 * push → toasts에 추가 + unreadCount 증가 + 4초 뒤 자동으로 list로 이동.
 * dismiss → 수동으로 즉시 list로 이동(예약된 타이머는 취소).
 * markAllRead → unreadCount만 0으로.
 */
export function createNotificationStore(): NotificationStore {
  let list: AppNotification[] = [];
  let toasts: AppNotification[] = [];
  let unreadCount = 0;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const moveToList = (id: string) => {
    const item = toasts.find((t) => t.id === id);
    timers.delete(id);
    if (!item) return;
    toasts = toasts.filter((t) => t.id !== id);
    list = [item, ...list];
    notify();
  };

  return {
    getSnapshot: () => ({ list, toasts, unreadCount }),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    push(n) {
      toasts = [...toasts, n];
      unreadCount += 1;
      const timer = setTimeout(() => moveToList(n.id), TOAST_LIFETIME_MS);
      timers.set(n.id, timer);
      notify();
    },

    dismiss(id) {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      moveToList(id);
    },

    markAllRead() {
      unreadCount = 0;
      notify();
    },
  };
}

export interface UseNotificationsResult {
  list: AppNotification[];
  toasts: AppNotification[];
  unreadCount: number;
  push(n: AppNotification): void;
  dismiss(id: string): void;
  markAllRead(): void;
}

/** React 어댑터 — 앱에서 한 번 호출해 store 인스턴스를 소유하고 스냅샷 변경 시 리렌더한다. */
export function useNotifications(): UseNotificationsResult {
  const [store] = useState(() => createNotificationStore());
  const [snapshot, setSnapshot] = useState(() => store.getSnapshot());

  useEffect(() => store.subscribe(() => setSnapshot(store.getSnapshot())), [store]);

  const push = useCallback((n: AppNotification) => store.push(n), [store]);
  const dismiss = useCallback((id: string) => store.dismiss(id), [store]);
  const markAllRead = useCallback(() => store.markAllRead(), [store]);

  return { list: snapshot.list, toasts: snapshot.toasts, unreadCount: snapshot.unreadCount, push, dismiss, markAllRead };
}

/**
 * RESPONSE_SCRIPT를 setTimeout 큐로 재생해 각 항목을 afterMs에 push한다.
 * 확정(CONFIRM) 후 홈으로 돌아왔을 때 page.tsx가 호출하는 용도다(배선은 이 파일의 몫이 아니다).
 * 반환된 cancel()로 아직 발화하지 않은 예약을 모두 취소할 수 있다.
 */
export function playResponseScript(push: (n: AppNotification) => void): () => void {
  let counter = 0;
  const timers = RESPONSE_SCRIPT.map((item) =>
    setTimeout(() => {
      counter += 1;
      push({
        id: `resp-${counter}`,
        kind: 'response',
        personId: item.personId,
        text: item.text,
        at: item.afterMs,
      });
    }, item.afterMs)
  );
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
