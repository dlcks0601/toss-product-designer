/**
 * 앱 상태 reducer — 단일 페이지 스텝 머신. 순수 함수만 포함한다(React 임포트 금지, 테스트는 렌더 없이 돈다).
 *
 * 스텝: home(내 캘린더) → setup(참석자·조건) → find(추천 슬롯) → confirm(확정 전 마지막 조정)
 *      → done(완료) / invite(수신 초대 응답, 여정 B).
 *
 * 불변식:
 *  - 주최자(ME_ID)는 항상 attendeeIds[]에 있고 필수(required)다 — TOGGLE_ATTENDEE로 제거 불가.
 *  - attendeeIds.length >= 2 이면 "회의 모드"다(파생 셀렉터 isMeeting).
 *  - 조건(기한·길이·필수 여부·참석자 구성)이 바뀌면 이전 선택은 낡은 것이다 — selectedSlotId·
 *    allowPartialRequiredId를 초기화해 find 화면이 새 조건으로 다시 계산하게 한다.
 *  - CONFIRM은 selectedSlotId가 있어야만 유효하다(없으면 상태 불변).
 *  - "확정됨" CTA는 confirmedAt(세션 통산 플래그)이 아니라 confirmedSlotId로 슬롯에 스코프된다 —
 *    selectedSlotId === confirmedSlotId일 때만 확정 상태다. 조건 변경·PREFILL 등 낡은 선택을
 *    초기화하는 액션은 confirmedSlotId도 함께 비운다(슬롯 id가 day+시각뿐이라 결정적이라,
 *    비우지 않으면 다음 여정에서 같은 id를 다시 골랐을 때 확정 전인데도 오탐할 수 있다).
 */
import type { CalendarEvent, DeadlineKind } from '../lib/types';
import { parseState, serializeState } from '../lib/urlState';
import type { UrlAttendee } from '../lib/urlState';
import { INCOMING_INVITE, ME_ID } from '../data/world';

export type Step = 'home' | 'setup' | 'find' | 'confirm' | 'done' | 'invite' | 'notifications';

export interface AppState {
  step: Step;
  title: string;
  attendeeIds: string[];
  required: Record<string, boolean>;
  duration: 30 | 60 | 90;
  deadline: DeadlineKind;
  selectedSlotId: string | null;
  allowPartialRequiredId: string | null;
  roomId: string | 'remote' | null;
  scanPlayed: boolean;
  mitigations: { delayTen: boolean; fiftyMin: boolean };
  inviteResponded: 'accepted' | 'difficult' | null;
  /** 이번 세션 중 한 번이라도 확정한 적이 있는가 — CTA 분기는 이 값이 아니라 confirmedSlotId를 본다. */
  confirmedAt: boolean;
  /**
   * 방금 확정된 슬롯 id — CONFIRM이 그 시점의 selectedSlotId를 스냅샷한다.
   * 세션 로컬(URL 비직렬화)이며, 조건 변경·PREFILL 등으로 selectedSlotId가 초기화되면
   * "확정됨" CTA는 selectedSlotId === confirmedSlotId가 깨지는 순간 자동으로 해제된다.
   */
  confirmedSlotId: string | null;
  /**
   * 홈 캘린더가 ME.events에 얹어 그리는 내 세션 일정 — 혼자 경로 저장(personal)과
   * 확정된 회의(CONFIRM, meeting)가 여기 쌓인다. URL 비직렬화(세션 한정).
   */
  myEvents: CalendarEvent[];
}

export type Action =
  | { type: 'SET_STEP'; step: Step }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'TOGGLE_ATTENDEE'; id: string }
  | { type: 'SET_REQUIRED'; id: string; required: boolean }
  | { type: 'SET_DURATION'; duration: 30 | 60 | 90 }
  | { type: 'SET_DEADLINE'; deadline: DeadlineKind }
  | { type: 'ADD_MY_EVENT'; event: CalendarEvent }
  | { type: 'SELECT_SLOT'; slotId: string | null }
  | { type: 'ALLOW_PARTIAL'; id: string | null }
  | { type: 'SET_ROOM'; roomId: string | 'remote' | null }
  | { type: 'HYDRATE'; patch: Partial<AppState> }
  | { type: 'PLAY_SCAN' }
  | { type: 'TOGGLE_MITIGATION'; key: keyof AppState['mitigations'] }
  | { type: 'RESPOND_INVITE'; response: 'accepted' | 'difficult' }
  | { type: 'CONFIRM'; event?: { day: string; start: number; end: number; room?: string } }
  | { type: 'RESET' };

/** 앱 시작 상태 — 주최자(나) 1인, 회의 모드 아님. */
export function initialState(): AppState {
  return {
    step: 'home',
    title: '',
    attendeeIds: [ME_ID],
    required: { [ME_ID]: true },
    duration: 60,
    deadline: 'next-week',
    selectedSlotId: null,
    allowPartialRequiredId: null,
    roomId: null,
    scanPlayed: false,
    mitigations: { delayTen: false, fiftyMin: false },
    inviteResponded: null,
    confirmedAt: false,
    confirmedSlotId: null,
    myEvents: [],
  };
}

/** 파생 셀렉터 — 참석자 2인 이상이면 회의 모드다(1인이면 "내 일정 저장" 경로). */
export function isMeeting(state: AppState): boolean {
  return state.attendeeIds.length >= 2;
}

/**
 * 조건 변경 patch를 적용하며 낡은 선택을 초기화한다.
 * confirmedSlotId도 함께 비운다 — 슬롯 id는 day+시각뿐이라 myEvents와 무관하게 결정적이다.
 * 그대로 두면 새 여정에서 우연히 같은 id의 슬롯을 다시 골랐을 때 아직 확정하지 않았는데도
 * selectedSlotId === confirmedSlotId가 되어 "확정됨" CTA가 잘못 뜬다(오탐).
 */
function applyAndInvalidateSelection(s: AppState, patch: Partial<AppState>): AppState {
  return { ...s, ...patch, selectedSlotId: null, allowPartialRequiredId: null, confirmedSlotId: null };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'SET_STEP':
      return { ...s, step: a.step };

    case 'SET_TITLE':
      return { ...s, title: a.title };

    case 'TOGGLE_ATTENDEE': {
      const already = s.attendeeIds.includes(a.id);
      if (already) {
        if (a.id === ME_ID) return s; // 주최자는 고정 — 제거 불가(no-op)
        const required = { ...s.required };
        delete required[a.id];
        // 참석자 구성이 바뀌면 후보 집합이 바뀐다 → 이전 선택 무효화.
        return applyAndInvalidateSelection(s, {
          attendeeIds: s.attendeeIds.filter((id) => id !== a.id),
          required,
        });
      }
      // 새로 추가되는 참석자는 기본값 "꼭 참석"이다. 추가 역시 후보 집합을 바꾼다 → 선택 무효화.
      return applyAndInvalidateSelection(s, {
        attendeeIds: [...s.attendeeIds, a.id],
        required: { ...s.required, [a.id]: true },
      });
    }

    case 'SET_REQUIRED':
      return applyAndInvalidateSelection(s, { required: { ...s.required, [a.id]: a.required } });

    case 'SET_DURATION':
      return applyAndInvalidateSelection(s, { duration: a.duration });

    case 'SET_DEADLINE':
      return applyAndInvalidateSelection(s, { deadline: a.deadline });

    case 'ADD_MY_EVENT': {
      // 혼자 경로의 저장 — 종류는 폼의 선택(집중 시간/외근/점심/휴가)을 존중한다.
      // 단 meeting은 시간 찾기 경로에서만 태어난다(불변식) — 들어오면 focus로 강등.
      // 저장 즉시 홈으로 복귀하고 다음 작성을 위해 제목을 비운다.
      const kind = a.event.kind === 'meeting' ? 'focus' : a.event.kind;
      return {
        ...s,
        myEvents: [...s.myEvents, { ...a.event, kind }],
        title: '',
        step: 'home',
      };
    }

    case 'SELECT_SLOT':
      return { ...s, selectedSlotId: a.slotId };

    case 'ALLOW_PARTIAL':
      return { ...s, allowPartialRequiredId: a.id };

    case 'SET_ROOM':
      return { ...s, roomId: a.roomId };

    case 'HYDRATE': {
      // 마운트 시 1회 — fromUrl(location.search)의 부분 패치를 안전하게 병합한다.
      const merged: AppState = { ...s, ...a.patch };
      // 참석자가 비어 오는 딥링크(쿼리 없음/무효 토큰)는 기존 구성을 유지한다.
      if (!a.patch.attendeeIds || a.patch.attendeeIds.length === 0) {
        merged.attendeeIds = s.attendeeIds;
        merged.required = s.required;
      }
      // 주최자 불변식 복구 — ME_ID는 항상 포함이며 항상 필수다.
      if (!merged.attendeeIds.includes(ME_ID)) {
        merged.attendeeIds = [ME_ID, ...merged.attendeeIds];
      }
      merged.required = { ...merged.required, [ME_ID]: true };
      return merged;
    }

    case 'PLAY_SCAN':
      return { ...s, scanPlayed: true };

    case 'TOGGLE_MITIGATION':
      return { ...s, mitigations: { ...s.mitigations, [a.key]: !s.mitigations[a.key] } };

    case 'RESPOND_INVITE': {
      // 여정 B의 응답은 1회 계약 — 이미 응답했다면 no-op(중복 myEvents 추가 방지).
      if (s.inviteResponded !== null) return s;
      if (a.response === 'accepted') {
        // 참석할게요 = 초대가 내 캘린더의 사실이 된다 — 반복 초대라 시리즈 전체(매주 목)가 앉는다.
        return {
          ...s,
          inviteResponded: 'accepted',
          myEvents: [
            ...s.myEvents,
            ...INCOMING_INVITE.days.map((day) => ({
              id: `invite-${day}T${INCOMING_INVITE.start}`,
              day,
              start: INCOMING_INVITE.start,
              end: INCOMING_INVITE.end,
              title: INCOMING_INVITE.title,
              kind: 'meeting' as const,
              room: INCOMING_INVITE.room,
            })),
          ],
        };
      }
      // 어려워요 = 플래그만 — 홈의 고스트 초대·카드가 함께 사라진다(렌더 게이트).
      return { ...s, inviteResponded: 'difficult' };
    }

    case 'CONFIRM': {
      if (s.selectedSlotId === null) return s; // 슬롯 미선택이면 무효
      // 확정 = 내 캘린더의 사실이 된다 — 조정 반영된 시간(event)을 회의로 추가한다.
      // ADD_MY_EVENT는 personal 강제 + 홈 복귀라 재사용하지 않고 여기서 meeting으로 넣는다.
      const myEvents = a.event
        ? [
            ...s.myEvents,
            {
              id: `confirmed-${a.event.day}T${a.event.start}`,
              day: a.event.day,
              start: a.event.start,
              end: a.event.end,
              title: s.title.trim() || '팀 회의',
              kind: 'meeting' as const,
              room: a.event.room,
            },
          ]
        : s.myEvents;
      return { ...s, myEvents, confirmedAt: true, confirmedSlotId: s.selectedSlotId, step: 'done' };
    }

    case 'RESET': {
      // 완전 초기화하되, 내 캘린더에 이미 저장된 개인 일정(myEvents)은 지우지 않는다 — 조율 여정만 초기화한다.
      return { ...initialState(), myEvents: s.myEvents };
    }

    default:
      return s;
  }
}

// ── URL 동기화 헬퍼(순수) ──────────────────────────────────────
// history.replaceState 등 실제 주소창 배선은 page.tsx가 소유한다(여기서는 문자열 매핑만).

/** AppState → 쿼리 문자열. organizer(ME_ID)를 p의 맨 앞으로 올린다. */
export function toUrl(state: AppState): string {
  const attendees: UrlAttendee[] = state.attendeeIds.map((id) => ({
    id,
    required: !!state.required[id],
  }));
  return serializeState({
    attendees,
    organizerId: ME_ID,
    duration: state.duration,
    deadline: state.deadline,
    step: state.step,
    selectedSlotId: state.selectedSlotId,
    allowPartialFor: state.allowPartialRequiredId,
  });
}

/** 쿼리 문자열 → AppState 부분 패치. 병합은 호출부(page.tsx)의 몫이다. */
export function fromUrl(qs: string): Partial<AppState> {
  const parsed = parseState(qs);
  const required: Record<string, boolean> = {};
  for (const a of parsed.attendees) required[a.id] = a.required;
  return {
    attendeeIds: parsed.attendees.map((a) => a.id),
    required,
    duration: parsed.duration as 30 | 60 | 90, // parseState는 {30,60,90} 중 하나로만 채운다
    deadline: parsed.deadline,
    step: parsed.step,
    selectedSlotId: parsed.selectedSlotId,
    allowPartialRequiredId: parsed.allowPartialFor,
  };
}
