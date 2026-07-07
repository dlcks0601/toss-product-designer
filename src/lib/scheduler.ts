import type { Attendee, CandidateSlot, PersonInsights, Room, Rules } from './types';
import { isBusinessDay } from './time';
import { hasBlockingConflict, isOutsideWorkHours, requiredFrame, scoreSlot } from './scoring';
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
}): CandidateSlot[] {
  const { attendees, rules, rooms, insights } = args;
  const { days, durationMinutes } = rules;

  const required = attendees.filter((a) => a.attendanceType === 'required');
  const frame = requiredFrame(attendees);
  const alignedStart = Math.ceil(frame.start / SLOT_STEP) * SLOT_STEP;
  const lastStart = frame.end - durationMinutes; // 프레임이 비면 alignedStart보다 작아 루프가 안 돈다

  const slots: CandidateSlot[] = [];

  for (const day of days) {
    if (!isBusinessDay(day)) continue; // 결함⑥: 주말은 슬롯을 만들지 않는다

    for (let start = alignedStart; start <= lastStart; start += SLOT_STEP) {
      const end = start + durationMinutes;

      // 하드필터 (a): 필수 참석자의 meeting·offsite·personal과 겹치면 제거
      if (required.some((a) => hasBlockingConflict(a, day, start, end))) continue;
      // 하드필터 (b): 필수 참석자 근무시간 밖이면 제거(프레임으로 대부분 보장되나 불변식 유지)
      if (required.some((a) => isOutsideWorkHours(a, start, end))) continue;

      const { effects, partials, roomIds } = scoreSlot({ day, start, end, attendees, insights, rooms });
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

  slots.sort((x, y) => {
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
