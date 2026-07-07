import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNotificationStore, playResponseScript } from './notifications';
import type { AppNotification } from '../lib/types';

const note = (id: string): AppNotification => ({ id, kind: 'response', text: `알림 ${id}`, at: 0 });

describe('createNotificationStore — push/토스트/알림 센터', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('push하면 toasts에 들어가고 unreadCount가 증가한다', () => {
    const store = createNotificationStore();
    store.push(note('a'));
    const snap = store.getSnapshot();
    expect(snap.toasts).toEqual([note('a')]);
    expect(snap.list).toEqual([]);
    expect(snap.unreadCount).toBe(1);
  });

  it('4000ms가 지나면 toasts에서 list로 자동 이동한다(알림 센터 적립)', () => {
    const store = createNotificationStore();
    store.push(note('a'));

    vi.advanceTimersByTime(3999);
    expect(store.getSnapshot().toasts).toEqual([note('a')]);
    expect(store.getSnapshot().list).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(store.getSnapshot().toasts).toEqual([]);
    expect(store.getSnapshot().list).toEqual([note('a')]);
  });

  it('list로 옮겨져도 unreadCount는 그대로다(읽음 처리와 별개)', () => {
    const store = createNotificationStore();
    store.push(note('a'));
    vi.advanceTimersByTime(4000);
    expect(store.getSnapshot().unreadCount).toBe(1);
  });

  it('dismiss는 예약된 자동 이동 없이 즉시 list로 옮긴다', () => {
    const store = createNotificationStore();
    store.push(note('a'));
    store.dismiss('a');
    expect(store.getSnapshot().toasts).toEqual([]);
    expect(store.getSnapshot().list).toEqual([note('a')]);

    // 이미 옮겨졌으니 4초 뒤 타이머가 발화해도 중복 추가되지 않는다.
    vi.advanceTimersByTime(4000);
    expect(store.getSnapshot().list).toEqual([note('a')]);
  });

  it('markAllRead는 unreadCount만 0으로 만들고 list/toasts는 건드리지 않는다', () => {
    const store = createNotificationStore();
    store.push(note('a'));
    store.push(note('b'));
    store.markAllRead();
    const snap = store.getSnapshot();
    expect(snap.unreadCount).toBe(0);
    expect(snap.toasts).toEqual([note('a'), note('b')]);
  });

  it('subscribe는 상태 변경 시 통지되고 unsubscribe 후에는 통지되지 않는다', () => {
    const store = createNotificationStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.push(note('a'));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.push(note('b'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('playResponseScript — RESPONSE_SCRIPT 재생', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('afterMs(3000/6000/10000)에 맞춰 3번 push를 예약한다', () => {
    const push = vi.fn();
    playResponseScript(push);

    expect(push).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatchObject({ personId: 'junho', kind: 'response', text: '준호님이 참석해요' });

    vi.advanceTimersByTime(3000); // 총 6000ms
    expect(push).toHaveBeenCalledTimes(2);
    expect(push.mock.calls[1][0]).toMatchObject({ personId: 'seoyeon', text: '서연님이 참석해요' });

    vi.advanceTimersByTime(4000); // 총 10000ms
    expect(push).toHaveBeenCalledTimes(3);
    expect(push.mock.calls[2][0]).toMatchObject({ personId: 'haneul', text: '하늘님이 앞 30분 함께해요' });
  });

  it('id는 카운터 기반이라 결정적이고 서로 다르다(Math.random 아님)', () => {
    const push = vi.fn();
    playResponseScript(push);
    vi.advanceTimersByTime(10000);
    const ids = push.mock.calls.map((c) => c[0].id);
    expect(ids).toEqual(['resp-1', 'resp-2', 'resp-3']);
  });

  it('at은 발화 시각(epoch ms)이다 — 알림 센터 상대시간의 근거', () => {
    const push = vi.fn();
    const base = Date.now(); // fake timers — advanceTimersByTime이 Date도 함께 움직인다
    playResponseScript(push);
    vi.advanceTimersByTime(3000);
    expect(push.mock.calls[0][0].at).toBe(base + 3000);
    vi.advanceTimersByTime(3000);
    expect(push.mock.calls[1][0].at).toBe(base + 6000);
  });

  it('cancel()을 호출하면 아직 발화하지 않은 예약이 모두 취소된다', () => {
    const push = vi.fn();
    const cancel = playResponseScript(push);

    vi.advanceTimersByTime(3000);
    expect(push).toHaveBeenCalledTimes(1);

    cancel();
    vi.advanceTimersByTime(10000);
    expect(push).toHaveBeenCalledTimes(1); // 이후 예약(6000/10000)은 발화하지 않는다
  });
});
