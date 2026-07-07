'use client';

import { ChevronRight } from 'lucide-react';
import Reveal from './Reveal';
import { josa } from '../lib/reasons';
import { NEXT_DEADLINE } from '../lib/relaxation';
import type { RelaxationSuggestion } from '../lib/relaxation';
import type { Action } from '../app-state/reducer';
import type { DeadlineKind } from '../lib/types';

/**
 * 결정 모먼트 — 기한 안에 후보가 없거나(빈 상태) 전부 아쉬울 때 등장하는 정직한 중재.
 * 시스템은 몰래 기준을 낮추지 않는다: suggestRelaxations의 실측 결과(최대 3)를 그대로 보여주고,
 * 사용자가 고르면 그 조건 변화만 dispatch한다 — 후보가 다시 서면 카드는 자연 소멸.
 *
 * 닫기 버튼은 없다(항상 선택지가 답). '한 번만' 규칙은 호출부가 decisionKey(조건 해시)로
 * 관리한다 — 같은 조건 조합에 1회, 조건 패널을 직접 만지는 것도 유효한 응답으로 친다.
 * 등장은 Reveal 한 번(warning tone이지만 차분하게 — 오로라 없음).
 */

/** 타이틀 '{기한 라벨}까지는…'에 붙는 창 라벨 — 조건 칩 카피('이번 주 안에')와 달리 '까지'에 자연스러운 형태. */
const WINDOW_LABEL: Record<DeadlineKind, string> = {
  'this-week': '이번 주',
  'next-week': '다음 주',
  flexible: '그 다음 주',
};

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

export interface DecisionMomentProps {
  /** suggestRelaxations 실측 결과 그대로(최대 3) — 숫자 재가공 금지. */
  suggestions: RelaxationSuggestion[];
  /** findBottleneck 결과(+이름) — 있으면 서브 카피로 원인을 지목한다. */
  bottleneck: { name: string; eventTitle: string } | null;
  /** empty = 표시 후보 0 / all-warning = 표시 후보 전부 warning. 타이틀 분기. */
  mode: 'empty' | 'all-warning';
  deadline: DeadlineKind;
  onPick: (suggestion: RelaxationSuggestion) => void;
}

export default function DecisionMoment({ suggestions, bottleneck, mode, deadline, onPick }: DecisionMomentProps) {
  const title =
    mode === 'empty' ? `${WINDOW_LABEL[deadline]}까지는 모두가 편한 시간이 없어요` : '가능한 시간이 전부 아쉬워요';

  return (
    <Reveal as="section" className="rounded-card border border-[#FFE082] bg-warn-bg p-5">
      <h2 className="text-[16px] font-bold leading-[1.4] tracking-[-0.01em] text-text-strong">{title}</h2>
      {bottleneck && (
        <p className="mt-1 text-[13px] leading-[1.5] text-text-body">
          {bottleneck.name}님의 {bottleneck.eventTitle}
          {josa(bottleneck.eventTitle, '이', '가')} 겹쳐요. 어떻게 할까요?
        </p>
      )}
      {suggestions.length === 0 ? (
        /* 시뮬이 열지 못한 극단 조건 — 거짓 제안 대신 직접 조정을 권한다. */
        <p className="mt-3 text-[13px] leading-[1.5] text-text-weak">
          참석자나 회의 길이를 직접 바꿔 주시면 바로 다시 찾아볼게요.
        </p>
      ) : (
        <ul className="mt-3.5 space-y-2">
          {suggestions.map((s) => (
            <li key={`${s.kind}:${s.targetId ?? ''}`}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="pressable flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left ring-1 ring-[#FFE082]/70"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-[1.4] text-text-strong">{s.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-[1.4] text-text-weak">{s.resultSummary}</span>
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Reveal>
  );
}
