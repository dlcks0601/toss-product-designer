'use client';

import { motion } from 'motion/react';
import type { BadgeTone } from './Badge';
import { summarizeSlot } from '../lib/reasons';
import type { CandidateSlot, ReasonTone, SlotReason } from '../lib/types';

/**
 * 이유의 조각들 — 이 제품의 목소리를 이루는 공용 헬퍼·칩 목록.
 * (구 이유 카드에서 슬림화 — 카드 UI는 시간 찾기 리디자인에서 폐기됐고,
 *  확정 화면(Reasons)과 초대 화면(REASON_TONE_CLASS)이 이 조각들을 계속 쓴다.)
 */

// ── 순수 헬퍼(테스트 대상) ─────────────────────────────────────────

/**
 * 뱃지 결정: severity 매핑(good→추천/tradeoff→일부 아쉬움/warning→주의)이 기본이되,
 * 리스트 1위(recommended)는 warning이 아닌 한 '추천'으로 올린다.
 */
export function badgeFor(
  severity: CandidateSlot['severity'],
  recommended = false,
): { tone: BadgeTone; label: string } {
  if (severity === 'warning') return { tone: 'warn', label: '주의' };
  if (severity === 'good' || recommended) return { tone: 'rec', label: '추천' };
  return { tone: 'ok', label: '일부 아쉬움' };
}

/**
 * 요약 1줄 — 기본은 summarizeSlot. 방어: reasons가 비었거나 positive가 하나도 없으면
 * summarizeSlot의 폴백("필수 N명 모두 편하게 참석할 수 있어요")이 살아나는데, 허락제
 * 부분 참석 슬롯(rankSlots가 all-required-ok를 제거한 슬롯)에서는 그 카피가 사실과
 * 모순된다 — 대신 첫 reason 문장을 그대로 쓴다.
 */
export function summaryLine(slot: Pick<CandidateSlot, 'reasons'>, requiredCount: number): string {
  if (!slot.reasons.some((r) => r.tone === 'positive')) {
    return slot.reasons[0]?.text ?? '';
  }
  return summarizeSlot(slot.reasons, requiredCount);
}

/** tone → 칩 클래스 — positive grey100 / tradeoff 파랑 tint / warning warn-bg(테두리 없는 언어). */
export const REASON_TONE_CLASS: Record<ReasonTone, string> = {
  positive: 'bg-section text-text-body',
  tradeoff: 'bg-primary-tint text-primary',
  warning: 'bg-warn-bg text-warn-fg',
};

/** 칩 스태거 간격(ms) — 확장 시 이유가 한 줄씩 말하듯 나타난다. */
export const REASON_STAGGER_MS = 40;

/**
 * 이유 칩 목록 — formatReasons 전체를 tone별 스타일로. 등장은 40ms 스태거.
 * 부분 참석 칩(optional-partial)은 핵심 정보라 살짝 강조한다(semibold+링).
 */
export function Reasons({ reasons, animated = true }: { reasons: SlotReason[]; animated?: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {reasons.map((r, i) => (
        <motion.li
          key={`${r.code}-${r.who ?? ''}-${i}`}
          initial={animated ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: animated ? (i * REASON_STAGGER_MS) / 1000 : 0, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`rounded-[10px] px-3 py-2 text-[13px] leading-[1.45] break-keep ${REASON_TONE_CLASS[r.tone]} ${
            r.code === 'optional-partial' ? 'font-semibold ring-1 ring-primary/30' : ''
          }`}
        >
          {r.text}
        </motion.li>
      ))}
    </ul>
  );
}

/** ConfirmStep의 `ReasonCard.Reasons` 호출 호환 — 카드 본체는 폐기, 조각만 남는다. */
const ReasonCard = { Reasons };
export default ReasonCard;
