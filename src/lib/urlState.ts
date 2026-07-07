/**
 * URL 상태 공유 — 조율 상태를 사람이 읽을 만한 쿼리 문자열로 직렬화한다.
 * React·window·history와 무관한 순수 모듈(urlState.test.ts가 계약). 앱 계층이 주소창을 소유한다.
 *
 * 형식: `p=ichan.r,junho.r,seoyeon.o&d=60&dl=nw&s=find&slot=2026-07-15T600&ap=junho`
 *  - p: 참석자 CSV, 지정 접미사 `.r`(꼭 참석)/`.o`(선택 참석), organizer 먼저
 *  - d: 회의 길이(분)  · dl: 기한(tw|nw|fx)  · s: 스텝
 *  - slot: 선택 슬롯 id(옵션)  · ap: 부분 참석 허용 대상 id(옵션)
 *
 * v1과 달리 스텝을 강등하지 않는다 — slot·ap까지 직렬화하므로 확정 상태도 딥링크로 복원된다.
 */
import type { DeadlineKind } from './types';

export type UrlStep = 'home' | 'setup' | 'find' | 'confirm' | 'done' | 'invite';

export interface UrlAttendee {
  id: string;
  required: boolean;
}

/** parseState 결과 — 항상 완전히 채워진다(null 허용 필드 포함). */
export interface ParsedUrlState {
  attendees: UrlAttendee[]; // organizer 먼저(직렬화 순서 보존)
  duration: number;
  deadline: DeadlineKind;
  step: UrlStep;
  selectedSlotId: string | null;
  allowPartialFor: string | null;
}

/** serializeState 입력 — 부분 상태. 빠진 필드는 안전 기본값으로 채운다. */
export interface SerializableState {
  attendees?: UrlAttendee[];
  organizerId?: string; // 주어지면 p의 맨 앞으로 올린다
  duration?: number;
  deadline?: DeadlineKind;
  step?: UrlStep;
  selectedSlotId?: string | null;
  allowPartialFor?: string | null;
}

const DEFAULT_DURATION = 60;
const DEFAULT_DEADLINE: DeadlineKind = 'next-week';
const DEFAULT_STEP: UrlStep = 'home';

const VALID_DURATIONS = new Set([30, 60, 90]);
const VALID_STEPS = new Set<UrlStep>(['home', 'setup', 'find', 'confirm', 'done', 'invite']);
/** id·slot 안전 문자만 직렬화 — 구분자(`.` `,` `&`)와 충돌하는 값은 건너뛴다. */
const SAFE = /^[A-Za-z0-9_-]+$/;

const DEADLINE_TO_CODE: Record<DeadlineKind, string> = {
  'this-week': 'tw',
  'next-week': 'nw',
  flexible: 'fx',
};
const CODE_TO_DEADLINE: Record<string, DeadlineKind> = {
  tw: 'this-week',
  nw: 'next-week',
  fx: 'flexible',
};

/** 상태 → 쿼리 문자열(선행 `?` 없음). URLSearchParams를 안 써서 `,`가 그대로 남는다. */
export function serializeState(state: SerializableState): string {
  const attendees = orderAttendees(state.attendees ?? [], state.organizerId);
  const p = attendees
    .filter((a) => SAFE.test(a.id))
    .map((a) => `${a.id}.${a.required ? 'r' : 'o'}`)
    .join(',');

  const duration = VALID_DURATIONS.has(state.duration ?? NaN) ? state.duration : DEFAULT_DURATION;
  const deadline = state.deadline && DEADLINE_TO_CODE[state.deadline] ? state.deadline : DEFAULT_DEADLINE;
  const step = state.step && VALID_STEPS.has(state.step) ? state.step : DEFAULT_STEP;

  const parts = [`p=${p}`, `d=${duration}`, `dl=${DEADLINE_TO_CODE[deadline]}`, `s=${step}`];
  const slot = state.selectedSlotId;
  if (slot && SAFE.test(slot)) parts.push(`slot=${slot}`);
  const ap = state.allowPartialFor;
  if (ap && SAFE.test(ap)) parts.push(`ap=${ap}`);
  return parts.join('&');
}

/** organizerId가 참석자 중에 있으면 맨 앞으로 이동(안정 정렬). */
function orderAttendees(attendees: UrlAttendee[], organizerId?: string): UrlAttendee[] {
  if (!organizerId) return attendees;
  const org = attendees.filter((a) => a.id === organizerId);
  if (org.length === 0) return attendees;
  return [...org, ...attendees.filter((a) => a.id !== organizerId)];
}

/** 쿼리 문자열 → 상태. 무효 토큰은 조용히 버리고 언제나 안전 기본값으로 완결한다. */
export function parseState(qs: string): ParsedUrlState {
  const fallback: ParsedUrlState = {
    attendees: [],
    duration: DEFAULT_DURATION,
    deadline: DEFAULT_DEADLINE,
    step: DEFAULT_STEP,
    selectedSlotId: null,
    allowPartialFor: null,
  };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
  } catch {
    return fallback;
  }

  const attendees: UrlAttendee[] = [];
  const seen = new Set<string>();
  for (const token of (params.get('p') ?? '').split(',')) {
    const parts = token.split('.');
    if (parts.length !== 2) continue;
    const [id, mark] = parts;
    if (!SAFE.test(id) || (mark !== 'r' && mark !== 'o') || seen.has(id)) continue;
    seen.add(id);
    attendees.push({ id, required: mark === 'r' });
  }

  const rawDuration = Number(params.get('d'));
  const duration = VALID_DURATIONS.has(rawDuration) ? rawDuration : DEFAULT_DURATION;
  const deadline = CODE_TO_DEADLINE[params.get('dl') ?? ''] ?? DEFAULT_DEADLINE;
  const rawStep = params.get('s') ?? '';
  const step = VALID_STEPS.has(rawStep as UrlStep) ? (rawStep as UrlStep) : DEFAULT_STEP;

  const slot = params.get('slot');
  const selectedSlotId = slot && SAFE.test(slot) ? slot : null;
  const ap = params.get('ap');
  const allowPartialFor = ap && SAFE.test(ap) ? ap : null;

  return { attendees, duration, deadline, step, selectedSlotId, allowPartialFor };
}
