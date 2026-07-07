import { describe, it, expect } from 'vitest';
import { reducer, initialState, isMeeting, toUrl, fromUrl } from './reducer';
import type { AppState } from './reducer';
import { DEFAULT_CAST, INCOMING_INVITE, ME_ID } from '../data/world';

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
    expect(s.confirmedSlotId).toBeNull();
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
    expect(next.confirmedSlotId).toBeNull();
    expect(next.step).toBe('home');
  });
  it('selectedSlotId가 있으면 confirmedAt=true, confirmedSlotId=selectedSlotId, step=done', () => {
    const withSlot: AppState = { ...initialState(), selectedSlotId: 'slot-1' };
    const next = reducer(withSlot, { type: 'CONFIRM' });
    expect(next.confirmedAt).toBe(true);
    expect(next.confirmedSlotId).toBe('slot-1');
    expect(next.step).toBe('done');
  });

  it('event를 실어 보내면 확정 회의가 내 캘린더(myEvents)에 meeting으로 추가된다', () => {
    const withSlot: AppState = { ...initialState(), selectedSlotId: 'slot-1' };
    const next = reducer(withSlot, {
      type: 'CONFIRM',
      event: { day: '2026-07-15', start: 610, end: 670 }, // 완화 조정 반영 시간 그대로
    });
    expect(next.myEvents).toHaveLength(1);
    expect(next.myEvents[0]).toMatchObject({
      day: '2026-07-15',
      start: 610,
      end: 670,
      kind: 'meeting',
      title: '팀 회의', // 제목 미입력 기본값
    });
  });

  it('제목이 있으면 그 제목으로 캘린더에 추가된다', () => {
    const withTitle: AppState = { ...initialState(), selectedSlotId: 'slot-1', title: '3분기 킥오프' };
    const next = reducer(withTitle, {
      type: 'CONFIRM',
      event: { day: '2026-07-15', start: 600, end: 660 },
    });
    expect(next.myEvents[0].title).toBe('3분기 킥오프');
  });

  it('selectedSlotId가 없으면 event가 있어도 캘린더에 추가되지 않는다', () => {
    const s = initialState();
    const next = reducer(s, { type: 'CONFIRM', event: { day: '2026-07-15', start: 600, end: 660 } });
    expect(next).toBe(s);
    expect(next.myEvents).toHaveLength(0);
  });

  it('기존 myEvents(혼자 경로 저장)는 유지된 채 뒤에 쌓인다', () => {
    const withPersonal: AppState = {
      ...initialState(),
      selectedSlotId: 'slot-1',
      myEvents: [{ id: 'p1', day: '2026-07-13', start: 540, end: 600, title: '운동', kind: 'personal' }],
    };
    const next = reducer(withPersonal, {
      type: 'CONFIRM',
      event: { day: '2026-07-15', start: 600, end: 660 },
    });
    expect(next.myEvents.map((e) => e.kind)).toEqual(['personal', 'meeting']);
  });
});

describe('confirmedSlotId — "확정됨" CTA는 confirmedAt이 아니라 슬롯 단위로 스코프된다', () => {
  it('두 번째 CONFIRM은 confirmedSlotId를 새 슬롯 id로 갱신한다(두 번째 회의도 확정 가능)', () => {
    const firstConfirmed = reducer(
      { ...initialState(), selectedSlotId: 'slot-1' },
      { type: 'CONFIRM' },
    );
    expect(firstConfirmed.confirmedSlotId).toBe('slot-1');

    // 두 번째 여정 — 새 슬롯을 선택하고 다시 CONFIRM.
    const reselected = reducer(firstConfirmed, { type: 'SELECT_SLOT', slotId: 'slot-2' });
    const secondConfirmed = reducer(reselected, { type: 'CONFIRM' });
    expect(secondConfirmed.confirmedSlotId).toBe('slot-2');
    expect(secondConfirmed.confirmedAt).toBe(true);
  });

  it('조건 변경(SET_DURATION 등)은 selectedSlotId뿐 아니라 confirmedSlotId도 비운다 — 오탐 방지', () => {
    // 슬롯 id는 day+시각뿐이라 결정적이다. 확정 슬롯을 비우지 않으면, 다음 여정에서 같은 id를
    // 우연히 다시 골랐을 때 아직 확정 전인데도 selectedSlotId === confirmedSlotId가 되어버린다.
    const confirmed = reducer({ ...initialState(), selectedSlotId: 'slot-1' }, { type: 'CONFIRM' });
    expect(confirmed.confirmedSlotId).toBe('slot-1');

    const next = reducer(confirmed, { type: 'SET_DURATION', duration: 30 });
    expect(next.selectedSlotId).toBeNull();
    expect(next.confirmedSlotId).toBeNull();

    // 같은 id를 다시 선택해도 confirmedSlotId가 이미 비었으니 오탐하지 않는다.
    const reselectedSame = reducer(next, { type: 'SELECT_SLOT', slotId: 'slot-1' });
    expect(reselectedSame.selectedSlotId).toBe('slot-1');
    expect(reselectedSame.confirmedSlotId).toBeNull();
  });

  it('PREFILL_CAST는 confirmedSlotId를 비운다', () => {
    const confirmed = reducer({ ...initialState(), selectedSlotId: 'slot-1' }, { type: 'CONFIRM' });
    const next = reducer(confirmed, { type: 'PREFILL_CAST' });
    expect(next.selectedSlotId).toBeNull();
    expect(next.confirmedSlotId).toBeNull();
  });

  it('RESET은 confirmedSlotId를 초기화한다', () => {
    const confirmed = reducer({ ...initialState(), selectedSlotId: 'slot-1' }, { type: 'CONFIRM' });
    const next = reducer(confirmed, { type: 'RESET' });
    expect(next.confirmedSlotId).toBeNull();
  });

  it('fromUrl은 confirmedSlotId를 포함하지 않는다 — 확정 상태는 세션 로컬이라 URL로 직렬화되지 않는다', () => {
    const patch = fromUrl(`p=${ME_ID}.r,junho.o&d=30&dl=tw&s=find&slot=slot-9&ap=junho`);
    expect(patch).not.toHaveProperty('confirmedSlotId');
  });

  it('HYDRATE 이후에도 confirmedSlotId는 그대로다(딥링크가 확정 상태를 되살리지 않는다)', () => {
    // 실제 부팅 시퀀스에서 HYDRATE는 initialState() 직후 1회만 실행되므로 confirmedSlotId는 항상 null이다.
    const patch = fromUrl(`p=${ME_ID}.r,junho.o&d=30&dl=tw&s=find&slot=slot-9`);
    const s = reducer(initialState(), { type: 'HYDRATE', patch });
    expect(s.confirmedSlotId).toBeNull();
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

describe('ADD_MY_EVENT — 혼자 경로의 개인 일정 저장', () => {
  const event = {
    id: 'my-2026-07-08-600',
    day: '2026-07-08',
    start: 600,
    end: 660,
    title: '치과 예약',
    kind: 'personal' as const,
  };

  it('myEvents에 추가하고 홈으로 복귀하며 제목을 비운다', () => {
    const inSetup: AppState = { ...initialState(), step: 'setup', title: '치과 예약' };
    const next = reducer(inSetup, { type: 'ADD_MY_EVENT', event });
    expect(next.myEvents).toEqual([event]);
    expect(next.step).toBe('home');
    expect(next.title).toBe('');
  });

  it('kind는 personal로 강제된다 — 다른 kind가 들어와도', () => {
    const next = reducer(initialState(), {
      type: 'ADD_MY_EVENT',
      event: { ...event, kind: 'meeting' },
    });
    expect(next.myEvents[0].kind).toBe('personal');
  });

  it('여러 번 저장하면 순서대로 누적된다', () => {
    const second = { ...event, id: 'my-2026-07-09-720', day: '2026-07-09', start: 720, end: 780 };
    let s = reducer(initialState(), { type: 'ADD_MY_EVENT', event });
    s = reducer(s, { type: 'ADD_MY_EVENT', event: second });
    expect(s.myEvents.map((e) => e.id)).toEqual([event.id, second.id]);
  });

  it('RESET은 myEvents를 보존한다 — 내 캘린더 데이터는 여정 초기화의 대상이 아니다', () => {
    const saved = reducer(initialState(), { type: 'ADD_MY_EVENT', event });
    const next = reducer({ ...saved, step: 'done' }, { type: 'RESET' });
    expect(next.myEvents).toEqual([event]);
    expect(next.step).toBe('home');
  });

  it('HYDRATE는 myEvents를 건드리지 않는다(URL 비직렬화)', () => {
    const saved = reducer(initialState(), { type: 'ADD_MY_EVENT', event });
    const next = reducer(saved, { type: 'HYDRATE', patch: fromUrl('p=junho.r&s=setup') });
    expect(next.myEvents).toEqual([event]);
  });
});

describe('PREFILL_CAST — 웰컴/할 일 카드 공용 6인 프리필', () => {
  it('기본 캐스트 6인으로 채우고(필수 4 + 선택 2) 셋업 스텝으로 이동한다', () => {
    const s = reducer(initialState(), { type: 'PREFILL_CAST' });
    expect(s.attendeeIds).toEqual([...DEFAULT_CAST.requiredIds, ...DEFAULT_CAST.optionalIds]);
    expect(s.attendeeIds[0]).toBe(ME_ID); // 주최자 맨 앞
    for (const id of DEFAULT_CAST.requiredIds) expect(s.required[id]).toBe(true);
    for (const id of DEFAULT_CAST.optionalIds) expect(s.required[id]).toBe(false);
    expect(s.step).toBe('setup');
    expect(isMeeting(s)).toBe(true);
  });

  it('여정 시작이므로 웰컴 카드를 접고, 이전 선택을 무효화한다', () => {
    const messy: AppState = { ...initialState(), selectedSlotId: 'slot-1', allowPartialRequiredId: 'junho' };
    const s = reducer(messy, { type: 'PREFILL_CAST' });
    expect(s.welcomeDismissed).toBe(true);
    expect(s.selectedSlotId).toBeNull();
    expect(s.allowPartialRequiredId).toBeNull();
  });
});

describe('HYDRATE — 마운트 1회 딥링크 병합', () => {
  it('fromUrl 패치를 병합한다', () => {
    const patch = fromUrl(`p=${ME_ID}.r,junho.o&d=30&dl=tw&s=find&slot=slot-9&ap=junho`);
    const s = reducer(initialState(), { type: 'HYDRATE', patch });
    expect(s.attendeeIds).toEqual([ME_ID, 'junho']);
    expect(s.required).toEqual({ [ME_ID]: true, junho: false });
    expect(s.duration).toBe(30);
    expect(s.deadline).toBe('this-week');
    expect(s.step).toBe('find');
    expect(s.selectedSlotId).toBe('slot-9');
    expect(s.allowPartialRequiredId).toBe('junho');
  });

  it('참석자가 비어 오면(빈 쿼리) 기존 구성을 유지한다', () => {
    const s = reducer(initialState(), { type: 'HYDRATE', patch: fromUrl('') });
    expect(s.attendeeIds).toEqual([ME_ID]);
    expect(s.required).toEqual({ [ME_ID]: true });
  });

  it('주최자 불변식을 복구한다 — ME_ID 누락이면 맨 앞에 넣고 항상 필수로 만든다', () => {
    const noMe = reducer(initialState(), { type: 'HYDRATE', patch: fromUrl('p=junho.r&s=home') });
    expect(noMe.attendeeIds).toEqual([ME_ID, 'junho']);
    expect(noMe.required[ME_ID]).toBe(true);

    const meOptional = reducer(initialState(), { type: 'HYDRATE', patch: fromUrl(`p=${ME_ID}.o,junho.r`) });
    expect(meOptional.required[ME_ID]).toBe(true); // .o로 와도 필수로 강제
  });

  it('홈 밖 스텝으로 착지하면 웰컴 카드를 접고, 홈이면 그대로 둔다', () => {
    const away = reducer(initialState(), { type: 'HYDRATE', patch: fromUrl('s=setup') });
    expect(away.welcomeDismissed).toBe(true);
    const home = reducer(initialState(), { type: 'HYDRATE', patch: fromUrl('s=home') });
    expect(home.welcomeDismissed).toBe(false);
  });
});

describe('그 외 단순 액션', () => {
  it('SET_STEP', () => {
    expect(reducer(initialState(), { type: 'SET_STEP', step: 'setup' }).step).toBe('setup');
  });
  it('SET_STEP — 홈을 떠나면 웰컴 카드가 자동으로 접히고, 홈 복귀로는 되살아나지 않는다', () => {
    const away = reducer(initialState(), { type: 'SET_STEP', step: 'invite' });
    expect(away.welcomeDismissed).toBe(true);
    const back = reducer(away, { type: 'SET_STEP', step: 'home' });
    expect(back.welcomeDismissed).toBe(true);
    // 홈 → 홈은 웰컴을 건드리지 않는다
    expect(reducer(initialState(), { type: 'SET_STEP', step: 'home' }).welcomeDismissed).toBe(false);
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

describe('RESPOND_INVITE — 여정 B 응답(수락→캘린더 반영 / 거절→플래그만)', () => {
  it('참석할게요 — INCOMING_INVITE가 내 캘린더(myEvents)에 meeting으로 자리 잡는다', () => {
    const next = reducer(initialState(), { type: 'RESPOND_INVITE', response: 'accepted' });
    expect(next.inviteResponded).toBe('accepted');
    expect(next.myEvents).toHaveLength(1);
    expect(next.myEvents[0]).toMatchObject({
      day: INCOMING_INVITE.day,
      start: INCOMING_INVITE.start,
      end: INCOMING_INVITE.end,
      title: INCOMING_INVITE.title,
      kind: 'meeting',
    });
  });

  it('어려워요 — 플래그만 세우고 캘린더는 건드리지 않는다(고스트·카드는 렌더 게이트로 소멸)', () => {
    const next = reducer(initialState(), { type: 'RESPOND_INVITE', response: 'difficult' });
    expect(next.inviteResponded).toBe('difficult');
    expect(next.myEvents).toHaveLength(0);
  });

  it('응답은 1회 — 이미 응답했다면 no-op(중복 myEvents 추가 방지)', () => {
    const accepted = reducer(initialState(), { type: 'RESPOND_INVITE', response: 'accepted' });
    const again = reducer(accepted, { type: 'RESPOND_INVITE', response: 'accepted' });
    expect(again).toBe(accepted); // 참조 동일 — 완전 no-op
    expect(again.myEvents).toHaveLength(1);
    // 다른 응답으로 바꾸려는 시도도 no-op이다.
    const flipped = reducer(accepted, { type: 'RESPOND_INVITE', response: 'difficult' });
    expect(flipped).toBe(accepted);
  });

  it('수락 회의는 기존 myEvents(확정 회의·개인 일정) 뒤에 쌓인다', () => {
    const withMeeting: AppState = {
      ...initialState(),
      myEvents: [{ id: 'confirmed-2026-07-15T600', day: '2026-07-15', start: 600, end: 660, title: '팀 회의', kind: 'meeting' }],
    };
    const next = reducer(withMeeting, { type: 'RESPOND_INVITE', response: 'accepted' });
    expect(next.myEvents.map((e) => e.id)).toEqual([
      'confirmed-2026-07-15T600',
      `invite-${INCOMING_INVITE.day}T${INCOMING_INVITE.start}`,
    ]);
  });

  it('RESET 후에도 수락으로 자리 잡은 회의는 남는다(myEvents 보존 계약)', () => {
    const accepted = reducer(initialState(), { type: 'RESPOND_INVITE', response: 'accepted' });
    const next = reducer(accepted, { type: 'RESET' });
    expect(next.myEvents).toHaveLength(1);
    expect(next.inviteResponded).toBeNull(); // 여정 상태는 초기화(기존 RESET 계약 유지)
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
      confirmedSlotId: 'slot-1',
    };
    const next = reducer(messy, { type: 'RESET' });
    expect(next).toEqual({ ...initialState(), welcomeDismissed: true });
  });

  it('welcomeDismissed가 false였으면 RESET 후에도 false다', () => {
    // SET_STEP은 홈을 떠날 때 웰컴을 접으므로, 접히지 않은 상태를 직접 구성한다.
    const s: AppState = { ...initialState(), step: 'done', welcomeDismissed: false };
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
