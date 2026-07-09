'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Badge, { type BadgeTone } from './Badge';
import MiniLocator from './MiniLocator';
import { summarizeSlot } from '../lib/reasons';
import { fmtDayKorean, fmtTime } from '../lib/time';
import type { Attendee, CandidateSlot, ReasonTone, SlotReason } from '../lib/types';

/**
 * 이유 카드 — 이 제품의 목소리. 슬롯 하나를 "사람의 상황"으로 말한다.
 * 모바일 리스트(T15)와 PC 레일(T16)이 같은 컴포넌트를 쓴다.
 *
 * 접힘: 요일·시각(15px bold) + 뱃지 + 요약 1줄 + 미니 로케이터.
 * 탭 → 그 자리에서 이유 칩 확장(formatReasons 전체, 40ms 스태거) — 카드가 곧 디테일 뷰다.
 *
 * API 두 겹: 평소엔 Flat(<ReasonCard slot … />) 하나면 된다. 레이아웃을 직접 쥐어야 하는
 * 소비자(PC 레일 변형 등)를 위해 조각(Frame/When/Reasons)을 compound로도 노출한다 —
 * Flat이 그 조각들을 그대로 조립하므로 두 API의 시각 결과는 항상 같다.
 */

// ── 순수 헬퍼(테스트 대상) ─────────────────────────────────────────

/**
 * 뱃지 결정: severity 매핑(good→추천/tradeoff→일부 아쉬움/warning→주의)이 기본이되,
 * 리스트 1위(recommended)는 warning이 아닌 한 '추천'으로 올린다 — 랭킹의 1위는
 * 말 그대로 시스템의 추천이고(S1: 부분 참석 포함 슬롯이 1위), '주의'만은 덮지 않는다.
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
 * 모순된다 — 대신 첫 reason 문장을 그대로 쓴다(T7에서 예고된 휴면 이슈의 UI측 방어).
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

// ── Compound 조각 ──────────────────────────────────────────────────

/** 카드 프레임 — 그림자만으로 뜨는 흰 카드(테두리 없음). 확장이면 파랑 링(기능적 표시)만. */
function Frame({ expanded, children }: { expanded?: boolean; children: ReactNode }) {
  return (
    <article
      className={`overflow-hidden rounded-card bg-white shadow-[0_2px_12px_rgba(25,31,40,0.07)] transition-shadow ${
        expanded ? 'ring-[1.5px] ring-primary/60' : ''
      }`}
    >
      {children}
    </article>
  );
}

/** 시간 행 — 요일·시각(15px bold) + 상태 뱃지. */
function When({ slot, recommended = false }: { slot: CandidateSlot; recommended?: boolean }) {
  const badge = badgeFor(slot.severity, recommended);
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[15px] font-bold tracking-[-0.01em] text-text-strong">
        {fmtDayKorean(slot.day)} {fmtTime(slot.start)}
      </p>
      <Badge tone={badge.tone}>{badge.label}</Badge>
    </div>
  );
}

/**
 * 이유 칩 목록 — formatReasons 전체를 tone별 스타일로. 등장은 40ms 스태거.
 * 부분 참석 칩(optional-partial)은 이 카드의 핵심 정보라 살짝 강조한다(semibold+링).
 */
function Reasons({ reasons, animated = true }: { reasons: SlotReason[]; animated?: boolean }) {
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

// ── Flat 본체 ──────────────────────────────────────────────────────

export interface ReasonCardProps {
  slot: CandidateSlot;
  /** 참석자 — 필수 인원수(요약 폴백)의 근거 */
  attendees: Attendee[];
  /** 기한 창 — 미니 로케이터의 주차 라벨 */
  windowDays: string[];
  expanded: boolean;
  /** 카드 탭(확장 토글) */
  onSelect: () => void;
  /** 리스트 1위 — warning이 아니면 '추천' 뱃지 */
  recommended?: boolean;
}

function ReasonCardBase({ slot, attendees, windowDays, expanded, onSelect, recommended = false }: ReasonCardProps) {
  const reduced = !!useReducedMotion();
  const requiredCount = attendees.filter((a) => a.attendanceType === 'required').length;

  return (
    <Frame expanded={expanded}>
      <button type="button" onClick={onSelect} aria-expanded={expanded} className="w-full p-4 text-left">
        <When slot={slot} recommended={recommended} />
        <p className="mt-1.5 truncate text-[13px] leading-[1.5] text-text-body">
          {summaryLine(slot, requiredCount)}
        </p>
        <div className="mt-3">
          <MiniLocator day={slot.day} start={slot.start} windowDays={windowDays} />
        </div>
      </button>

      {/* 확장 — 그 자리에서 이유 전체. 접힘은 즉시 언마운트(부모 FLIP이 수축을 받는다). */}
      {expanded && (
        <motion.div
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4">
            <Reasons reasons={slot.reasons} animated={!reduced} />
          </div>
        </motion.div>
      )}
    </Frame>
  );
}

/** Flat + Compound 이중 API — <ReasonCard …/> 또는 <ReasonCard.Frame>…</ReasonCard.Frame>. */
const ReasonCard = Object.assign(ReasonCardBase, { Frame, When, Reasons });
export default ReasonCard;
