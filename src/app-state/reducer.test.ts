import { describe, it, expect } from 'vitest';
import { reducer, initialState, isMeeting, toUrl, fromUrl } from './reducer';
import type { AppState } from './reducer';
import { ME_ID } from '../data/world';

describe('initialState', () => {
  it('홈 스텝 · 주최자 1인 · 회의 모드 아님 · 기본 길이 60 · 기한 다음 주까지', () => {
    const s = initialState();
    expect(s.step).toBe('home');
    expect(s.attendeeIds).toEqual([ME_ID]);
    expect(s.required).toEqual({ [ME_ID]: true });
    expect(s.duration).toBe(60);
    expect(s.deadline).toBe('next-week');
    expect(s.selectedSlotId).toBeNull();
    expect(s.allowPartialRequiredId).toBeNull();
    expect(s.roomId).toBeNull();
    expect(s.scanPlayed).toBe(false);
    expect(s.welcomeDismissed).toBe(false);
    expect(s.mitigations).toEqual({ delayTen: false, fiftyMin: false });
    expect(s.inviteResponded).toBeNull();
    expect(s.confirmedAt).toBe(false);
    expect(isMeeting(s)).toBe(false);
  });
});

describe('isMeeting — 파생 셀렉터', () => {
  it('참석자 1인이면 회의 모드가 아니다', () => {
    expect(isMeeting(initialState())).toBe(false);
  });
  it('참석자 2인 이상이면 회의 모드다', () => {
    const s = reducer(initialState(), { type: 'TOGGLE_ATTENDEE', id: 'junho' });
    expect(s.attendeeIds).toEqual([ME_ID, 'junho']);
    expect(isMeeting(s)).toBe(true);
  });
});

describe('TOGGLE_ATTENDEE', () => {
  it('없던 참석자를 추가하면 기본값 꼭 참석(required=true)', () => {
    const s = reducer(initialState(), { type: 'TOGGLE_ATTENDEE', id: 'seoyeon' });
    expect(s.attendeeIds).toContain('seoyeon');
    expect(s.required.seoyeon).toBe(true);
  });
  it('이미 있는 참석자를 다시 토글하면 제거되고 required 항목도 지워진다', () => {
    const added = reducer(initialState(), { type: 'TOGGLE_ATTENDEE', id: 'seoyeon' });
    const removed = reducer(added, { type: 'TOGGLE_ATTENDEE', id: 'seoyeon' });
    expect(removed.attendeeIds).not.toContain('seoyeon');
    expect(removed.required).not.toHaveProperty('seoyeon');
  });
  it('주최자(ME_ID) 제거 시도는 no-op이다', () => {
    const s = initialState();
    const next = reducer(s, { type: 'TOGGLE_ATTENDEE', id: ME_ID });
    expect(next).toBe(s); // 참조 동일 — 완전 no-op
    expect(next.attendeeIds).toEqual([ME_ID]);
  });
});

describe('CONFIRM — selectedSlotId 필수', () => {
  it('selectedSlotId가 없으면 상태가 바뀌지 않는다', () => {
    const s = initialState();
    const next = reducer(s, { type: 'CONFIRM' });
    expect(next).toBe(s);
    expect(next.confirmedAt).toBe(false);
    expect(next.step).toBe('home');
  });
  it('selectedSlotId가 있으면 confirmedAt=true, step=done', () => {
    const withSlot: AppState = { ...initialState(), selectedSlotId: 'slot-1' };
    const next = reducer(withSlot, { type: 'CONFIRM' });
    expect(next.confirmedAt).toBe(true);
    expect(next.step).toBe('done');
  });
});

describe('조건 변경 → 선택 낡음(stale) 초기화', () => {
  const withSelection: AppState = {
    ...initialState(),
    selectedSlotId: 'slot-1',
    allowPartialRequiredId: 'junho',
  };

  it('SET_DEADLINE은 selectedSlotId·allowPartialRequiredId를 초기화한다', () => {
    const next = reducer(withSelection, { type: 'SET_DEADLINE', deadline: 'this-week' });
    expect(next.deadline).toBe('this-week');
    expect(next.selectedSlotId).toBeNull();
    expect(next.allowPartialRequiredId).toBeNull();
  });

  it('SET_DURATION은 selectedSlotId·allowPartialRequiredId를 초기화한다', () => {
    const next = reducer(withSelection, { type: 'SET_DURATION', duration: 30 });
    expect(next.duration).toBe(30);
    expect(next.selectedSlotId).toBeNull();
    expect(next.allowPartialRequiredId).toBeNull();
  });

  it('SET_REQUIRED는 selectedSlotId·allowPartialRequiredId를 초기화한다', () => {
    const next = reducer(withSelection, { type: 'SET_REQUIRED', id: 'junho', required: false });
    expect(next.required.junho).toBe(false);
    expect(next.selectedSlotId).toBeNull();
    expect(next.allowPartialRequiredId).toBeNull();
  });

  it('TOGGLE_ATTENDEE(추가)는 selectedSlotId·allowPartialRequiredId를 초기화한다', () => {
    const next = reducer(withSelection, { type: 'TOGGLE_ATTENDEE', id: 'seoyeon' });
    expect(next.attendeeIds).toContain('seoyeon');
    expect(next.selectedSlotId).toBeNull();
    expect(next.allowPartialRequiredId).toBeNull();
  });

  it('TOGGLE_ATTENDEE(제거)도 selectedSlotId·allowPartialRequiredId를 초기화한다', () => {
    const withJunho: AppState = {
      ...withSelection,
      attendeeIds: [ME_ID, 'junho'],
      required: { [ME_ID]: true, junho: true },
    };
    const next = reducer(withJunho, { type: 'TOGGLE_ATTENDEE', id: 'junho' });
    expect(next.attendeeIds).not.toContain('junho');
    expect(next.selectedSlotId).toBeNull();
    expect(next.allowPartialRequiredId).toBeNull();
  });

  it('주최자 TOGGLE_ATTENDEE는 no-op이라 선택도 보존된다', () => {
    const next = reducer(withSelection, { type: 'TOGGLE_ATTENDEE', id: ME_ID });
    expect(next).toBe(withSelection);
    expect(next.selectedSlotId).toBe('slot-1');
    expect(next.allowPartialRequiredId).toBe('junho');
  });

  it('SELECT_SLOT·ALLOW_PARTIAL 자체는 서로를 지우지 않는다', () => {
    const selected = reducer(initialState(), { type: 'SELECT_SLOT', slotId: 'slot-9' });
    const allowed = reducer(selected, { type: 'ALLOW_PARTIAL', id: 'junho' });
    expect(allowed.selectedSlotId).toBe('slot-9');
    expect(allowed.allowPartialRequiredId).toBe('junho');
  });
});

describe('그 외 단순 액션', () => {
  it('SET_STEP', () => {
    expect(reducer(initialState(), { type: 'SET_STEP', step: 'setup' }).step).toBe('setup');
  });
  it('SET_TITLE', () => {
    expect(reducer(initialState(), { type: 'SET_TITLE', title: '주간 싱크' }).title).toBe('주간 싱크');
  });
  it('SET_ROOM', () => {
    expect(reducer(initialState(), { type: 'SET_ROOM', roomId: 'room-1' }).roomId).toBe('room-1');
    expect(reducer(initialState(), { type: 'SET_ROOM', roomId: 'remote' }).roomId).toBe('remote');
  });
  it('PLAY_SCAN', () => {
    expect(reducer(initialState(), { type: 'PLAY_SCAN' }).scanPlayed).toBe(true);
  });
  it('DISMISS_WELCOME', () => {
    expect(reducer(initialState(), { type: 'DISMISS_WELCOME' }).welcomeDismissed).toBe(true);
  });
  it('TOGGLE_MITIGATION은 지정한 키만 뒤집는다', () => {
    const once = reducer(initialState(), { type: 'TOGGLE_MITIGATION', key: 'delayTen' });
    expect(once.mitigations).toEqual({ delayTen: true, fiftyMin: false });
    const twice = reducer(once, { type: 'TOGGLE_MITIGATION', key: 'delayTen' });
    expect(twice.mitigations).toEqual({ delayTen: false, fiftyMin: false });
  });
  it('RESPOND_INVITE', () => {
    expect(reducer(initialState(), { type: 'RESPOND_INVITE', response: 'accepted' }).inviteResponded).toBe(
      'accepted'
    );
  });
});

describe('RESET', () => {
  it('welcomeDismissed를 보존하고 나머지는 initialState()로 되돌린다', () => {
    const messy: AppState = {
      ...initialState(),
      step: 'done',
      title: '아무 제목',
      attendeeIds: [ME_ID, 'junho', 'seoyeon'],
      required: { [ME_ID]: true, junho: true, seoyeon: false },
      duration: 90,
      deadline: 'flexible',
      selectedSlotId: 'slot-1',
      allowPartialRequiredId: 'junho',
      roomId: 'room-1',
      scanPlayed: true,
      welcomeDismissed: true,
      mitigations: { delayTen: true, fiftyMin: true },
      inviteResponded: 'accepted',
      confirmedAt: true,
    };
    const next = reducer(messy, { type: 'RESET' });
    expect(next).toEqual({ ...initialState(), welcomeDismissed: true });
  });

  it('welcomeDismissed가 false였으면 RESET 후에도 false다', () => {
    const s = reducer(initialState(), { type: 'SET_STEP', step: 'done' });
    expect(reducer(s, { type: 'RESET' }).welcomeDismissed).toBe(false);
  });
});

describe('시나리오 전이 — 홈 → 셋업 → find → confirm → done → 홈(RESET)', () => {
  it('전체 여정을 단계별로 밟아도 각 스텝의 불변식이 유지된다', () => {
    let s = initialState();
    expect(s.step).toBe('home');

    s = reducer(s, { type: 'SET_STEP', step: 'setup' });
    s = reducer(s, { type: 'TOGGLE_ATTENDEE', id: 'junho' });
    s = reducer(s, { type: 'TOGGLE_ATTENDEE', id: 'seoyeon' });
    expect(s.step).toBe('setup');
    expect(isMeeting(s)).toBe(true);

    s = reducer(s, { type: 'SET_STEP', step: 'find' });
    expect(s.step).toBe('find');

    s = reducer(s, { type: 'SELECT_SLOT', slotId: '2026-07-15T600' });
    s = reducer(s, { type: 'SET_STEP', step: 'confirm' });
    expect(s.step).toBe('confirm');
    expect(s.selectedSlotId).toBe('2026-07-15T600');

    s = reducer(s, { type: 'CONFIRM' });
    expect(s.step).toBe('done');
    expect(s.confirmedAt).toBe(true);

    s = reducer(s, { type: 'RESET' });
    expect(s.step).toBe('home');
    expect(s.attendeeIds).toEqual([ME_ID]);
    expect(s.confirmedAt).toBe(false);
    expect(s.selectedSlotId).toBeNull();
  });
});

describe('toUrl/fromUrl — AppState ↔ urlState 와이어 매핑', () => {
  it('toUrl은 organizer(ME_ID)를 p 맨 앞에 두고 필드를 매핑한다', () => {
    let s = initialState();
    s = reducer(s, { type: 'TOGGLE_ATTENDEE', id: 'junho' });
    s = reducer(s, { type: 'SET_REQUIRED', id: 'junho', required: false });
    s = { ...s, selectedSlotId: 'slot-1', allowPartialRequiredId: 'junho', step: 'confirm' };

    const qs = toUrl(s);
    const params = new URLSearchParams(qs);
    expect(params.get('p')).toBe(`${ME_ID}.r,junho.o`);
    expect(params.get('d')).toBe('60');
    expect(params.get('dl')).toBe('nw');
    expect(params.get('s')).toBe('confirm');
    expect(params.get('slot')).toBe('slot-1');
    expect(params.get('ap')).toBe('junho');
  });

  it('fromUrl은 attendeeIds·required·selectedSlotId·allowPartialRequiredId로 되돌린다', () => {
    const patch = fromUrl(`p=${ME_ID}.r,junho.o&d=30&dl=tw&s=find&slot=slot-9&ap=junho`);
    expect(patch.attendeeIds).toEqual([ME_ID, 'junho']);
    expect(patch.required).toEqual({ [ME_ID]: true, junho: false });
    expect(patch.duration).toBe(30);
    expect(patch.deadline).toBe('this-week');
    expect(patch.step).toBe('find');
    expect(patch.selectedSlotId).toBe('slot-9');
    expect(patch.allowPartialRequiredId).toBe('junho');
  });

  it('toUrl → fromUrl 라운드트립이 원래 조율 필드를 복원한다', () => {
    let s = initialState();
    s = reducer(s, { type: 'TOGGLE_ATTENDEE', id: 'junho' });
    s = reducer(s, { type: 'TOGGLE_ATTENDEE', id: 'seoyeon' });
    s = reducer(s, { type: 'SET_REQUIRED', id: 'seoyeon', required: false });
    s = reducer(s, { type: 'SET_DURATION', duration: 90 });
    s = reducer(s, { type: 'SET_DEADLINE', deadline: 'flexible' });
    s = { ...s, selectedSlotId: 'slot-42', allowPartialRequiredId: 'seoyeon', step: 'find' };

    const patch = fromUrl(toUrl(s));
    expect(patch.attendeeIds).toEqual(s.attendeeIds);
    expect(patch.required).toEqual(s.required);
    expect(patch.duration).toBe(s.duration);
    expect(patch.deadline).toBe(s.deadline);
    expect(patch.step).toBe(s.step);
    expect(patch.selectedSlotId).toBe(s.selectedSlotId);
    expect(patch.allowPartialRequiredId).toBe(s.allowPartialRequiredId);
  });
});
