'use client';

import type { Dispatch } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import Aurora from './Aurora';
import Reveal from './Reveal';
import Wordmark from './Wordmark';
import { activeMitigations, adjustedRange, type Mitigations } from './ConfirmStep';
import { useCandidates } from '../app-state/useCandidates';
import type { Action, AppState } from '../app-state/reducer';
import { ROOMS } from '../data/world';
import { fmtDayKorean, fmtRange } from '../lib/time';
import type { Attendee, CandidateSlot, Room } from '../lib/types';

/**
 * 완료 — 이 제품의 유일한 감정적 순간. "시간만 잡은 게 아니라 사람을 챙겼다"를 말한다.
 * 밝고 따뜻하게: Aurora 'done'(복숭아가 앞으로) + 체크 팝(52px 제자리 스프링 {500,18})
 * + 이리데슨트 타이틀(clip-text, DOM 텍스트 유지 — globals.css .iridescent).
 *
 * '함께 챙긴 것'은 선택 슬롯의 reasons/partials/완화 선택에서만 파생한다(하드코딩 금지) —
 * 챙길 것이 없으면 카드 자체가 없다. 응답 연출도 없다: '초대를 보냈어요' 한 줄로 끝내고,
 * 응답 토스트는 홈(T19)이 재생한다.
 */

// ── 순수 헬퍼(테스트 대상) ─────────────────────────────────────────

/** '함께 챙긴 것' 항목 파생 — 부분 참석(문구·안건·퇴장 알림), 외근(화상 링크), 완화 선택. */
export function careItems(input: {
  slot: Pick<CandidateSlot, 'reasons' | 'partials'>;
  attendees: Pick<Attendee, 'id' | 'name'>[];
  mitigations: Mitigations;
}): string[] {
  const { slot, attendees, mitigations } = input;
  const nameOf = (id?: string) => attendees.find((a) => a.id === id)?.name ?? null;

  const items: string[] = [];
  for (const p of slot.partials) {
    const name = nameOf(p.attendeeId);
    if (!name) continue;
    const part = p.part === 'front' ? '앞' : '뒤';
    items.push(`${name}님 초대에 "${part} ${p.minutes}분만 함께해도 충분해요" 문구를 담았어요`);
    items.push(`${name}님 몫 안건을 ${p.part === 'front' ? '앞쪽' : '뒤쪽'}에 배치하는 걸 추천했어요`);
    items.push(`${name}님 퇴장 5분 전에 알려드릴게요`); // 확정 화면의 '자동 포함' 약속
  }
  for (const r of slot.reasons) {
    if (r.code !== 'offsite-day') continue;
    const name = nameOf(r.who);
    if (!name) continue;
    items.push(`${name}님 외근 대비 화상 링크를 넣어뒀어요`);
  }
  if (mitigations.delayTen) items.push('모두의 점심 여유를 위해 10분 늦춰 시작해요');
  if (mitigations.fiftyMin) items.push('다음 일정을 위해 50분으로 마쳐요');
  return items;
}

/** roomId → 장소 라벨('화상' / 회의실 이름). 미선택·미상은 null(서브에서 생략). */
export function placeLabel(
  roomId: string | 'remote' | null,
  rooms: Pick<Room, 'id' | 'name'>[],
): string | null {
  if (roomId === 'remote') return '화상';
  return rooms.find((r) => r.id === roomId)?.name ?? null;
}

// ── 본체 ────────────────────────────────────────────────────────────

/** 체크 팝 — 제자리 스프링(오버슈트가 기쁨의 목소리). */
const POP_SPRING = { type: 'spring' as const, stiffness: 500, damping: 18 };

export interface DoneStepProps {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export default function DoneStep({ state, dispatch }: DoneStepProps) {
  const reduced = !!useReducedMotion();
  const candidates = useCandidates(state);
  const slot = candidates.slots.find((s) => s.id === state.selectedSlotId) ?? null;

  const active = slot ? activeMitigations(slot, state.mitigations) : { delayTen: false, fiftyMin: false };
  const adj = slot ? adjustedRange(slot, active) : null;
  const place = placeLabel(state.roomId, ROOMS);
  const items = slot ? careItems({ slot, attendees: candidates.attendees, mitigations: active }) : [];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      {/* 오로라 — 상단만. 아래는 흰빛으로 가라앉혀 카드가 단단히 선다. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[46dvh] overflow-hidden">
        <Aurora variant="done" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />
      </div>

      {/* 데스크톱 헤더 — 여정 전체의 틀. 축하 무대(오로라 done)는 그대로 두고 워드마크만 얹는다. */}
      <div className="absolute inset-x-0 top-0 z-10 hidden lg:block">
        <div className="mx-auto max-w-[1200px] px-6 py-4">
          <header className="flex h-10 items-center">
            <Wordmark />
          </header>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-[560px] flex-col items-center px-4 pb-16 pt-[10dvh]">
        {/* 체크 팝 — 52px, 제자리 스프링 {500,18} */}
        <motion.div
          initial={reduced ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={POP_SPRING}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary shadow-[0_8px_24px_rgba(49,130,246,0.35)]"
        >
          <Check size={28} strokeWidth={3} aria-hidden className="text-white" />
        </motion.div>

        <Reveal delay={120} className="pt-5 text-center">
          <h1 className="iridescent text-[28px] font-bold leading-[1.3] tracking-[-0.02em]">회의가 잡혔어요</h1>
        </Reveal>

        {slot && adj && (
          <Reveal delay={190} className="pt-2 text-center">
            <p className="text-[15px] font-medium leading-[1.5] text-text-body">
              {fmtDayKorean(slot.day)} {fmtRange(adj.start, adj.end)}
              {place ? ` · ${place}` : ''}
            </p>
          </Reveal>
        )}

        {/* 함께 챙긴 것 — 파생 항목이 없으면 카드도 없다 */}
        {items.length > 0 && (
          <Reveal delay={260} className="w-full pt-7">
            <section className="rounded-card bg-white p-5 shadow-[0_2px_16px_rgba(25,31,40,0.06)] ring-1 ring-border/70">
              <h2 className="text-[15px] font-bold tracking-[-0.01em] text-text-strong">함께 챙긴 것</h2>
              <ul className="mt-3 space-y-2">
                {items.map((text, i) => (
                  <motion.li
                    key={text}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduced ? 0 : 0.35 + i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="flex gap-2 text-[13px] leading-[1.55] text-text-body"
                  >
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    <span className="break-keep">{text}</span>
                  </motion.li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}

        <Reveal delay={330} className="w-full space-y-2 pt-7">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'home' })}
            className="pressable h-[54px] w-full rounded-2xl bg-primary-tint text-[16px] font-semibold text-primary transition-colors hover:bg-[#dcecfe]"
          >
            내 캘린더에서 보기
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'invite' })}
            className="pressable h-[54px] w-full rounded-2xl bg-white text-[16px] font-semibold text-text-body ring-1 ring-border"
          >
            참석자에게는 이렇게 보여요
          </button>
        </Reveal>

        {/* 응답 연출은 여기 없다 — 상태 한 줄로 끝, 토스트는 홈(T19)이 재생한다 */}
        <Reveal delay={400} className="pt-5">
          <p className="text-[12px] text-text-weak">초대를 보냈어요 · 응답이 오면 알려드릴게요</p>
        </Reveal>
      </div>
    </main>
  );
}
