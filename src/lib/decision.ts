/**
 * 결정 모먼트 로직 — '같은 조건 조합에 1회' 규칙의 키와, 제안 → 조건 변화 dispatch 매핑.
 * (구 DecisionMoment 컴포넌트에서 이동 — UI는 시간 찾기 화면이 직접 그린다.)
 *
 * 시스템은 몰래 기준을 낮추지 않는다: suggestRelaxations의 실측 결과를 그대로 보여주고,
 * 사용자가 고르면 그 조건 변화만 dispatch한다 — 후보가 다시 서면 제안은 자연 소멸.
 */
import { NEXT_DEADLINE } from './relaxation';
import type { RelaxationSuggestion } from './relaxation';
import type { Action } from '../app-state/reducer';
import type { DeadlineKind } from './types';

/** '같은 조건 조합에 1회' 규칙의 키 — 후보 계산에 영향을 주는 조건 전부의 해시. 참석자 순서에는 불변. */
export function decisionKey(c: {
  attendeeIds: string[];
  required: Record<string, boolean>;
  duration: 30 | 60 | 90;
  deadline: DeadlineKind;
  allowPartialRequiredId: string | null;
}): string {
  const people = [...c.attendeeIds]
    .sort()
    .map((id) => `${id}${c.required[id] ? '!' : '?'}`)
    .join(',');
  return `${people}|${c.duration}|${c.deadline}|${c.allowPartialRequiredId ?? ''}`;
}

/**
 * kind별 dispatch 매핑 — 시뮬이 돌린 patch와 같은 조건 변화만 일으킨다.
 * extend-deadline은 NEXT_DEADLINE 사다리(시뮬과 동일 소스)로 한 단계, 대상 없는 대상형 제안은 null.
 */
export function pickAction(s: RelaxationSuggestion, currentDeadline: DeadlineKind): Action | null {
  switch (s.kind) {
    case 'extend-deadline': {
      const next = NEXT_DEADLINE[currentDeadline];
      return next === null ? null : { type: 'SET_DEADLINE', deadline: next };
    }
    case 'shorten-meeting':
      return { type: 'SET_DURATION', duration: 30 };
    case 'make-optional':
      return s.targetId ? { type: 'SET_REQUIRED', id: s.targetId, required: false } : null;
    case 'allow-partial-required':
      return s.targetId ? { type: 'ALLOW_PARTIAL', id: s.targetId } : null;
  }
}
