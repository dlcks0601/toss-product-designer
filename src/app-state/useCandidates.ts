'use client';

/**
 * 후보 파생 훅 — state(조건)만 보고 추천 슬롯을 순수·동기로 계산한다. 로딩 상태 없음.
 *
 * 파이프라인: attendeeIds → Attendee[](ORG 널가드) → windowFor(deadline) →
 * deriveAllInsights(참석자만) → rankSlots(+허락제 옵션) → visible(상위 5).
 * 각 단계는 순수 함수로 분리되어 렌더 없이 테스트한다(useCandidates.test.ts).
 *
 * 계약:
 *  - visible은 항상 slice(0, VISIBLE_COUNT) — 결정 모먼트(needsDecision)도 표시 후보
 *    기준으로 판정한다(결함⑤: 전수검사 금지).
 *  - 조건이 바뀌면 reducer가 selectedSlotId를 이미 무효화했으므로 여기서는 신경 쓰지 않는다.
 */
import { useMemo } from 'react';
import { ME_ID, ORG, ROOMS } from '../data/world';
import { deriveAllInsights } from '../lib/insights';
import { findBottleneck, suggestRelaxations } from '../lib/relaxation';
import { needsDecisionMoment, rankSlots } from '../lib/scheduler';
import { windowFor } from '../lib/window';
import type { RelaxationSuggestion } from '../lib/relaxation';
import type { Attendee, CandidateSlot, DeadlineKind, PersonInsights } from '../lib/types';
import type { AppState } from './reducer';

/** 리스트에 보여주는 최대 후보 수 — FLIP 대상도, 결정 모먼트 판정도 이 5개다. */
export const VISIBLE_COUNT = 5;

/**
 * attendeeIds + required 맵 → Attendee[]. ORG에 없는 id(딥링크 오염)는 조용히 건너뛴다.
 * 순서는 state 순서 그대로(주최자가 맨 앞) — 엔진은 순서 무관, UI가 그대로 그린다.
 */
export function buildAttendees(attendeeIds: string[], required: Record<string, boolean>): Attendee[] {
  const attendees: Attendee[] = [];
  for (const id of attendeeIds) {
    const person = ORG.find((p) => p.id === id);
    if (!person) continue;
    attendees.push({
      ...person,
      attendanceType: required[id] ? 'required' : 'optional',
      ...(id === ME_ID ? { isOrganizer: true } : {}),
    });
  }
  return attendees;
}

export interface Candidates {
  attendees: Attendee[];
  windowDays: string[];
  insights: Record<string, PersonInsights>;
  slots: CandidateSlot[];
  visible: CandidateSlot[];
  needsDecision: boolean;
  /** 결정 모먼트 선택지 — needsDecision일 때만 시뮬(비용)해서 채운다. 아닐 땐 []. */
  suggestions: RelaxationSuggestion[];
  /** 병목 지목(+이름) — needsDecision일 때만. 없거나 계산 안 하면 null. */
  bottleneck: DecisionBottleneck | null;
}

export interface DecisionBottleneck {
  personId: string;
  name: string;
  eventTitle: string;
}

/** needsDecision이 아닐 때 돌려주는 고정 결과 — useMemo 참조 안정성용. */
const NO_DECISION: { suggestions: RelaxationSuggestion[]; bottleneck: DecisionBottleneck | null } = {
  suggestions: [],
  bottleneck: null,
};

/** 결정 모먼트 재료 — 완화 시뮬 + 병목 지목(이름까지 붙여 UI가 바로 쓰게). needsDecision일 때만 호출. */
export function computeDecisionContext(input: {
  attendees: Attendee[];
  windowDays: string[];
  insights: Record<string, PersonInsights>;
  duration: 30 | 60 | 90;
  deadline: DeadlineKind;
}): { suggestions: RelaxationSuggestion[]; bottleneck: DecisionBottleneck | null } {
  const args = {
    attendees: input.attendees,
    rules: { days: input.windowDays, durationMinutes: input.duration, deadline: input.deadline },
    rooms: ROOMS,
    insights: input.insights,
  };
  const suggestions = suggestRelaxations(args);
  const raw = findBottleneck(args);
  const bottleneck = raw
    ? { ...raw, name: input.attendees.find((a) => a.id === raw.personId)?.name ?? raw.personId }
    : null;
  return { suggestions, bottleneck };
}

/** 훅의 계산 전체를 담은 순수 함수 — 테스트가 이 함수를 직접 친다. */
export function computeCandidates(input: {
  attendeeIds: string[];
  required: Record<string, boolean>;
  duration: 30 | 60 | 90;
  deadline: DeadlineKind;
  allowPartialRequiredId: string | null;
}): Candidates {
  const attendees = buildAttendees(input.attendeeIds, input.required);
  const windowDays = windowFor(input.deadline);
  const insights = deriveAllInsights(attendees, windowDays);
  const slots = rankSlots(
    {
      attendees,
      rules: { days: windowDays, durationMinutes: input.duration, deadline: input.deadline },
      rooms: ROOMS,
      insights,
    },
    input.allowPartialRequiredId ? { allowPartialFor: input.allowPartialRequiredId } : undefined,
  );
  const visible = slots.slice(0, VISIBLE_COUNT);
  const needsDecision = needsDecisionMoment(visible);
  const decision = needsDecision
    ? computeDecisionContext({ attendees, windowDays, insights, duration: input.duration, deadline: input.deadline })
    : NO_DECISION;
  return { attendees, windowDays, insights, slots, visible, needsDecision, ...decision };
}

/**
 * state → 후보 파생. 층별 useMemo — 참석자 구성이 그대로면 insights를 재계산하지 않고,
 * 길이만 바뀌면 rankSlots만 다시 돈다.
 */
export function useCandidates(state: AppState): Candidates {
  const attendees = useMemo(
    () => buildAttendees(state.attendeeIds, state.required),
    [state.attendeeIds, state.required],
  );
  const windowDays = useMemo(() => windowFor(state.deadline), [state.deadline]);
  const insights = useMemo(() => deriveAllInsights(attendees, windowDays), [attendees, windowDays]);
  const slots = useMemo(
    () =>
      rankSlots(
        {
          attendees,
          rules: { days: windowDays, durationMinutes: state.duration, deadline: state.deadline },
          rooms: ROOMS,
          insights,
        },
        state.allowPartialRequiredId ? { allowPartialFor: state.allowPartialRequiredId } : undefined,
      ),
    [attendees, windowDays, insights, state.duration, state.deadline, state.allowPartialRequiredId],
  );
  const visible = useMemo(() => slots.slice(0, VISIBLE_COUNT), [slots]);
  const needsDecision = needsDecisionMoment(visible);
  // 완화 시뮬은 rankSlots를 여러 번 돌리는 비싼 계산 — 결정 모먼트가 필요할 때만 조건부로.
  const decision = useMemo(
    () =>
      needsDecision
        ? computeDecisionContext({ attendees, windowDays, insights, duration: state.duration, deadline: state.deadline })
        : NO_DECISION,
    [needsDecision, attendees, windowDays, insights, state.duration, state.deadline],
  );
  return { attendees, windowDays, insights, slots, visible, needsDecision, ...decision };
}
