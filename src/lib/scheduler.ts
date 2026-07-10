import type { Attendee, CandidateSlot, PartialInfo, PersonInsights, Room, Rules } from './types';
import { isBusinessDay } from './time';
import { hasBlockingConflict, isOutsideWorkHours, requiredFrame, scoreSlot } from './scoring';
import { partialAvailability } from './partial';
import { formatReasons, slotSeverity } from './reasons';

const SLOT_STEP = 30;

/**
 * v1 골격 이식: 필수 근무시간 교집합 프레임 → 30분 스텝 → 하드필터 → 소프트 점수 정렬.
 * 결함 수정: 주말 가드(⑥), 빈 프레임 graceful, urgent 제거, 점수/카피 분리.
 */
export function rankSlots(args: {
  attendees: Attendee[];
  rules: Rules;
  rooms: Room[];
  insights: Record<string, PersonInsights>;
}, opts?: { allowPartialFor?: string }): CandidateSlot[] {
  const { attendees, rules, rooms, insights } = args;
  const { days, durationMinutes } = rules;
  // 허락제 부분 참석(결정 3): 이 대상 필수 참석자는 '부분 참석' 가능한 슬롯에서만 하드필터를 통과한다.
  const allowPartialFor = opts?.allowPartialFor;

  const required = attendees.filter((a) => a.attendanceType === 'required');
  const frame = requiredFrame(attendees);
  const alignedStart = Math.ceil(frame.start / SLOT_STEP) * SLOT_STEP;
  const lastStart = frame.end - durationMinutes; // 프레임이 비면 alignedStart보다 작아 루프가 안 돈다

  const slots: CandidateSlot[] = [];

  for (const day of days) {
    if (!isBusinessDay(day)) continue; // 결함⑥: 주말은 슬롯을 만들지 않는다

    for (let start = alignedStart; start <= lastStart; start += SLOT_STEP) {
      const end = start + durationMinutes;

      // 하드필터 (a): 필수 참석자의 meeting·offsite·personal과 겹치면 제거.
      // 단, allowPartialFor 대상이 '부분 참석'(앞/뒤 절반 이상 빔) 가능하면 그 슬롯은 통과시킨다.
      // allowPartialFor가 없으면 이 루프는 `required.some(hasBlockingConflict)`와 완전히 동일하게 동작한다.
      let partialForTarget: PartialInfo | null = null;
      let blocked = false;
      for (const a of required) {
        if (!hasBlockingConflict(a, day, start, end)) continue;
        if (a.id === allowPartialFor) {
          const pa = partialAvailability(a, day, { start, end });
          if (pa.kind === 'partial') {
            partialForTarget = pa.info; // 통과 — 부분 참석으로 함께한다
            continue;
          }
        }
        blocked = true; // 예외 대상이 아니거나 'none'이면 여전히 막는다
        break;
      }
      if (blocked) continue;
      // 하드필터 (b): 필수 참석자 근무시간 밖이면 제거(프레임으로 대부분 보장되나 불변식 유지)
      if (required.some((a) => isOutsideWorkHours(a, start, end))) continue;

      const { effects, partials, roomIds } = scoreSlot({ day, start, end, attendees, insights, rooms });
      // 허락제 통과 슬롯: optional-partial(delta 0) effect + PartialInfo를 덧붙인다 — 카피가 필수에게도 그대로 읽힌다.
      if (partialForTarget) {
        // 이 슬롯은 필수 중 한 명이 '부분 참석'이므로 "필수 N명 모두 편하게 참석" 카피와 모순된다 — 제거.
        const okIdx = effects.findIndex((e) => e.code === 'all-required-ok');
        if (okIdx >= 0) effects.splice(okIdx, 1);
        effects.push({
          code: 'optional-partial',
          delta: 0,
          who: partialForTarget.attendeeId,
          data: { part: partialForTarget.part, minutes: partialForTarget.minutes, title: partialForTarget.conflictTitle },
        });
        partials.push(partialForTarget);
      }
      const score = effects.reduce((sum, e) => sum + e.delta, 0);
      const reasons = formatReasons(effects, attendees);

      slots.push({
        id: `${day}T${start}`,
        day,
        start,
        end,
        score,
        reasons,
        partials,
        severity: slotSeverity(reasons),
        roomIds,
      });
    }
  }

  // 참석 완전성 > 편의 보너스 — 모두 온전한(good) 슬롯은 점심 전 같은 리듬 보너스로
  // 부풀려진 tradeoff에 절대 밀리지 않는다(2026-07-10, "왜 부분 참석이 1위냐" 수정).
  // 같은 계층 안에서는 점수 — 부분(+7) > 불참(-4) 계약은 tradeoff 계층 내부에서 그대로 산다.
  const tier = { good: 0, tradeoff: 1, warning: 2 } as const;
  slots.sort((x, y) => {
    if (tier[x.severity] !== tier[y.severity]) return tier[x.severity] - tier[y.severity];
    if (y.score !== x.score) return y.score - x.score;
    if (x.day !== y.day) return x.day < y.day ? -1 : 1;
    return x.start - y.start;
  });

  return slots;
}

/** 표시 후보가 없거나 전부 warning이면 true(결함⑤). 순수 — 호출부가 상위 N개만 넘긴다. */
export function needsDecisionMoment(visibleSlots: CandidateSlot[]): boolean {
  return visibleSlots.length === 0 || visibleSlots.every((s) => s.severity === 'warning');
}
