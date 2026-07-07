'use client';

import { useState, type Dispatch } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronLeft, Eye } from 'lucide-react';
import Avatar from './Avatar';
import Reveal from './Reveal';
import { REASON_TONE_CLASS, REASON_STAGGER_MS } from './ReasonCard';
import { activeMitigations, adjustedRange, fmtDuration } from './ConfirmStep';
import { useCandidates } from '../app-state/useCandidates';
import type { Action, AppState } from '../app-state/reducer';
import { INCOMING_INVITE, ORG } from '../data/world';
import { fmtRange, weekdayIndex } from '../lib/time';
import type { Minutes } from '../lib/time';
import type { Attendee, CandidateSlot, SlotReason } from '../lib/types';

/**
 * 초대 뷰(step 'invite') — 여정 B의 본체이자, 여정 A의 마지막 거울.
 *
 * mode 'incoming': 민수가 보낸 INCOMING_INVITE를 받는 사람(나) 관점으로 —
 *   '왜 이 시간인가요' reasonsForMe에서 내 이야기 행(첫 줄)은 파랑 강조.
 *   응답은 1회: 참석할게요(→ 내 캘린더에 자리 잡음) / 어려워요(사유 칩 1개 → 전송).
 *   재조율 없음 — 사유 전송으로 끝, '민수님에게 전달했어요 ✓'로 상태 전환.
 * mode 'preview': 내가 방금 확정한 초대를 수신자 관점으로 미리 본다 —
 *   선택 슬롯의 reasons를 그대로(formatReasons 실출력) 쓰고, 수신자에게 해당하는
 *   행을 강조. 응답 버튼은 미리보기라 disabled. 상단에 관점 배너(grey100).
 * ← 은 어느 모드든 home 고정(controller binding — 단순함이 답).
 */

// ── 순수 헬퍼(테스트 대상) ─────────────────────────────────────────

/** 성을 뗀 호칭 — '최민수' → '민수'. 2글자 이름('이찬')은 그대로(토스트 '준호님' 톤). */
export function givenName(name: string): string {
  return name.length >= 3 ? name.slice(1) : name;
}

const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** '목 7월 9일 오후 2:00–3:00' — 초대 카드의 시각 한 줄. */
export function inviteWhenLabel(day: string, start: Minutes, end: Minutes): string {
  const [, month, date] = day.split('-').map(Number);
  return `${WEEKDAY_SHORT[weekdayIndex(day)]} ${month}월 ${date}일 ${fmtRange(start, end)}`;
}

/** 초대 뷰가 그리는 데이터 한 벌 — incoming/preview가 이 모양으로 수렴한다(데이터 소스 전환). */
export interface InviteModel {
  /** 보낸 사람 id — 아바타·아이덴티티 */
  fromId: string;
  /** '민수님이 회원님 포함 5명과 잡은 1시간' */
  headline: string;
  title: string;
  whenLabel: string;
  reasons: SlotReason[];
  /** 파랑 강조 행(수신자 자신의 이야기) — 없으면 -1 */
  highlightIndex: number;
}

/** incoming 모드 — INCOMING_INVITE 그대로. 내 이야기(첫 줄)가 강조 행이다. */
export function incomingInviteModel(): InviteModel {
  const from = ORG.find((p) => p.id === INCOMING_INVITE.fromId)!;
  const duration = fmtDuration(INCOMING_INVITE.end - INCOMING_INVITE.start);
  return {
    fromId: INCOMING_INVITE.fromId,
    headline: `${givenName(from.name)}님이 회원님 포함 ${INCOMING_INVITE.attendeeCount}명과 잡은 ${duration}`,
    title: INCOMING_INVITE.title,
    whenLabel: inviteWhenLabel(INCOMING_INVITE.day, INCOMING_INVITE.start, INCOMING_INVITE.end),
    reasons: INCOMING_INVITE.reasonsForMe,
    highlightIndex: 0,
  };
}

/**
 * preview 모드의 수신자 선택 — 주최자를 뺀 참석자 중, 슬롯의 reasons(who)나
 * partials에 실제로 언급된 첫 사람(강조 행이 살아있는 미리보기). 아무도 언급되지
 * 않으면 첫 번째 수신자(기본 캐스트에선 준호). 수신자가 없으면 null(혼자 경로).
 */
export function pickPreviewViewer(
  slot: Pick<CandidateSlot, 'reasons' | 'partials'>,
  attendees: Pick<Attendee, 'id' | 'name' | 'isOrganizer'>[],
): Pick<Attendee, 'id' | 'name' | 'isOrganizer'> | null {
  const recipients = attendees.filter((a) => !a.isOrganizer);
  if (recipients.length === 0) return null;
  const mentioned = new Set([
    ...slot.reasons.map((r) => r.who).filter((w): w is string => !!w),
    ...slot.partials.map((p) => p.attendeeId),
  ]);
  return recipients.find((a) => mentioned.has(a.id)) ?? recipients[0];
}

/**
 * preview 모드 — 내가 방금 보낸 초대를 수신자(viewer) 관점으로.
 * reasons는 선택 슬롯의 실출력(formatReasons 결과) 재사용, viewer가 언급된 행을 강조.
 * 반환 null이면 미리볼 수신자가 없다(가드는 호출부의 몫).
 */
export function previewInviteModel(input: {
  slot: Pick<CandidateSlot, 'day' | 'reasons' | 'partials'>;
  attendees: Pick<Attendee, 'id' | 'name' | 'isOrganizer'>[];
  title: string;
  adjusted: { start: Minutes; end: Minutes };
}): { model: InviteModel; viewerName: string } | null {
  const { slot, attendees, title, adjusted } = input;
  const viewer = pickPreviewViewer(slot, attendees);
  const me = attendees.find((a) => a.isOrganizer);
  if (!viewer || !me) return null;
  return {
    viewerName: givenName(viewer.name),
    model: {
      fromId: me.id,
      headline: `${givenName(me.name)}님이 회원님 포함 ${attendees.length}명과 잡은 ${fmtDuration(adjusted.end - adjusted.start)}`,
      title: title.trim() || '팀 회의',
      whenLabel: inviteWhenLabel(slot.day, adjusted.start, adjusted.end),
      reasons: slot.reasons,
      highlightIndex: slot.reasons.findIndex((r) => r.who === viewer.id),
    },
  };
}

/** 어려워요 사유 칩 — 1회 선택으로 전송된다(재조율 없음, 사유는 각본상 표시·전달용). */
export const DIFFICULT_REASONS = ['일정이 겹쳐요', '외근이에요', '시간이 촉박해요', '기타'] as const;

// ── 작은 조각들 ────────────────────────────────────────────────────

/** 이유 행 — tone 칩 스타일 재사용, 강조 행(수신자 자신의 이야기)은 파랑 tint+semibold. */
function ReasonRows({ reasons, highlightIndex, animated }: { reasons: SlotReason[]; highlightIndex: number; animated: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {reasons.map((r, i) => (
        <motion.li
          key={`${r.code}-${r.who ?? ''}-${i}`}
          initial={animated ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: animated ? (i * REASON_STAGGER_MS) / 1000 : 0, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`rounded-[10px] px-3 py-2 text-[13px] leading-[1.45] break-keep ${
            i === highlightIndex ? 'bg-primary-tint font-semibold text-primary' : REASON_TONE_CLASS[r.tone]
          }`}
        >
          {r.text}
        </motion.li>
      ))}
    </ul>
  );
}

const POP_SPRING = { type: 'spring' as const, stiffness: 500, damping: 18 };

// ── 본체 ────────────────────────────────────────────────────────────

export interface InviteViewProps {
  /** incoming: 민수의 초대(여정 B) / preview: 내가 보낸 초대의 수신자 관점(done에서 진입) */
  mode: 'incoming' | 'preview';
  state: AppState;
  dispatch: Dispatch<Action>;
  /** 응답 배선(1회) — page.tsx가 RESPOND_INVITE 디스패치 + 알림 센터 적립을 함께 처리한다. */
  onRespond?: (response: 'accepted' | 'difficult') => void;
}

export default function InviteView({ mode, state, dispatch, onRespond }: InviteViewProps) {
  const reduced = !!useReducedMotion();
  const candidates = useCandidates(state);
  const [asking, setAsking] = useState(false); // 어려워요 → 사유 칩 노출

  const goHome = () => dispatch({ type: 'SET_STEP', step: 'home' });

  // ── 데이터 소스 전환(binding 2) ──
  let model: InviteModel | null = null;
  let viewerName: string | null = null;
  if (mode === 'incoming') {
    model = incomingInviteModel();
  } else {
    const slot = candidates.slots.find((s) => s.id === state.selectedSlotId) ?? null;
    if (slot) {
      const adjusted = adjustedRange(slot, activeMitigations(slot, state.mitigations));
      const preview = previewInviteModel({ slot, attendees: candidates.attendees, title: state.title, adjusted });
      if (preview) {
        model = preview.model;
        viewerName = preview.viewerName;
      }
    }
  }

  // 미리보기 가드 — 슬롯이 낡았거나(조건 변경) 수신자가 없으면 정직하게 되돌린다.
  if (!model) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-5 px-4">
        <Reveal className="w-full rounded-card bg-section px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-text-strong">미리 볼 초대가 없어요</p>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-text-weak">조건이 바뀌었나 봐요 — 홈에서 다시 시작해 주세요</p>
        </Reveal>
        <Reveal delay={70}>
          <button
            type="button"
            onClick={goHome}
            className="pressable inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-semibold text-text-body ring-1 ring-border"
          >
            홈으로
          </button>
        </Reveal>
      </main>
    );
  }

  const from = ORG.find((p) => p.id === model.fromId)!;
  const fromGiven = givenName(from.name);
  const responded = mode === 'incoming' ? state.inviteResponded : null;
  const isPreview = mode === 'preview';

  const respond = (response: 'accepted' | 'difficult') => {
    if (isPreview || responded !== null) return;
    onRespond?.(response);
  };

  return (
    <main className="min-h-dvh bg-bg pb-16">
      <div className="mx-auto w-full max-w-[560px] px-4">
        {/* 헤더 — ← 은 home 고정(binding 1) */}
        <Reveal as="header" className="-mx-1 flex h-14 items-center">
          <button
            type="button"
            onClick={goHome}
            className="pressable -ml-1 flex h-10 items-center gap-1 rounded-full pl-1.5 pr-3 text-[15px] font-semibold text-text-strong hover:bg-section"
          >
            <ChevronLeft size={20} aria-hidden />홈
          </button>
        </Reveal>

        {/* 관점 배너 — preview 전용(grey100) */}
        {isPreview && viewerName && (
          <Reveal className="pt-1">
            <div className="flex items-center gap-2 rounded-xl bg-section px-4 py-3">
              <Eye size={16} aria-hidden className="shrink-0 text-text-weak" />
              <p className="text-[13px] font-semibold text-text-body">{viewerName}님에게는 이렇게 보여요</p>
            </div>
          </Reveal>
        )}

        {/* 초대 카드 */}
        <Reveal delay={70} className={isPreview ? 'pt-3' : 'pt-1'}>
          <section className="rounded-card bg-white p-5 shadow-[0_2px_16px_rgba(25,31,40,0.06)] ring-1 ring-border/70">
            <div className="flex items-center gap-3">
              <Avatar person={from} size={40} />
              <p className="min-w-0 text-[13px] font-semibold leading-[1.4] text-primary break-keep">{model.headline}</p>
            </div>
            <h1 className="pt-4 text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong">
              {model.title}
            </h1>
            <p className="mt-1 text-[15px] font-medium text-text-body">{model.whenLabel}</p>
          </section>
        </Reveal>

        {/* 왜 이 시간인가요 — 주최자가 챙긴 배려를 수신자도 '본다' */}
        {model.reasons.length > 0 && (
          <Reveal delay={140} className="pt-6">
            <h2 className="text-[14px] font-semibold text-text-strong">왜 이 시간인가요</h2>
            <div className="mt-2.5">
              <ReasonRows reasons={model.reasons} highlightIndex={model.highlightIndex} animated={!reduced} />
            </div>
          </Reveal>
        )}

        {/* 응답 영역 */}
        <Reveal delay={210} className="pt-7">
          {responded !== null ? (
            // 응답 완료 — 카드 상태 전환 '민수님에게 전달했어요 ✓'
            <section className="rounded-card bg-white p-5 text-center shadow-[0_2px_16px_rgba(25,31,40,0.06)] ring-1 ring-border/70">
              <motion.span
                initial={reduced ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={POP_SPRING}
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary"
              >
                <Check size={22} strokeWidth={3} aria-hidden className="text-white" />
              </motion.span>
              <p className="pt-3 text-[16px] font-bold tracking-[-0.01em] text-text-strong">
                {fromGiven}님에게 전달했어요
              </p>
              <p className="mt-1 text-[13px] leading-[1.5] text-text-weak">
                {responded === 'accepted'
                  ? '내 캘린더에 일정이 자리 잡았어요'
                  : '어려운 사정도 배려예요 — 사유를 함께 전했어요'}
              </p>
              <button
                type="button"
                onClick={goHome}
                className="pressable mt-4 h-[48px] w-full rounded-2xl bg-primary-tint text-[15px] font-semibold text-primary transition-colors hover:bg-[#dcecfe]"
              >
                내 캘린더에서 보기
              </button>
            </section>
          ) : asking && !isPreview ? (
            // 어려워요 → 사유 칩 4개, 1회 선택이 곧 전송(재조율 없음)
            <section>
              <p className="text-[14px] font-semibold text-text-strong">어떤 사정인지 살짝 알려주시겠어요?</p>
              <p className="mt-1 text-[12px] text-text-weak">{fromGiven}님에게 사유와 함께 전달돼요</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DIFFICULT_REASONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => respond('difficult')}
                    className="pressable inline-flex h-10 items-center rounded-full bg-section px-4 text-[14px] font-medium text-text-body transition-colors hover:bg-border/70"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="pressable mt-4 text-[13px] font-medium text-text-weak underline-offset-2 hover:underline"
              >
                돌아가기
              </button>
            </section>
          ) : (
            // 기본 — 참석할게요 / 어려워요 (preview에선 disabled + '미리보기예요')
            <div className="space-y-2" title={isPreview ? '미리보기예요' : undefined}>
              <button
                type="button"
                disabled={isPreview}
                onClick={() => respond('accepted')}
                className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white transition-colors active:bg-primary-pressed disabled:bg-section disabled:text-text-faint"
              >
                참석할게요
              </button>
              <button
                type="button"
                disabled={isPreview}
                onClick={() => setAsking(true)}
                className="pressable h-[54px] w-full rounded-2xl bg-white text-[16px] font-semibold text-text-body ring-1 ring-border disabled:bg-section disabled:text-text-faint disabled:ring-0"
              >
                어려워요
              </button>
              {isPreview && (
                <p className="pt-1 text-center text-[12px] text-text-weak">미리보기예요 — 응답은 받은 사람만 할 수 있어요</p>
              )}
            </div>
          )}
        </Reveal>
      </div>
    </main>
  );
}
