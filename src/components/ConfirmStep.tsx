'use client';

import type { Dispatch } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronLeft, Video } from 'lucide-react';
import Aurora from './Aurora';
import FrostedBar from './FrostedBar';
import Badge from './Badge';
import ReasonCard from './ReasonCard';
import Reveal from './Reveal';
import Wordmark from './Wordmark';
import { useCandidates } from '../app-state/useCandidates';
import type { Action, AppState } from '../app-state/reducer';
import { ROOMS } from '../data/world';
import { availableRooms } from '../lib/rooms';
import { fmtDayKorean, fmtRange, fmtTime } from '../lib/time';
import type { Minutes } from '../lib/time';
import type { CandidateSlot, Room, SlotReason } from '../lib/types';

/**
 * 확정 — 마지막 조정의 자리. 확정 직전에도 긴장 라인을 다시 보여주고(정직함 유지),
 * 슬롯의 실제 맥락에서만 '모두를 위한 조정' 완화 토글을 꺼낸다(하드코딩 금지).
 *
 * 완화의 계약: reducer의 mitigations는 delayTen·fiftyMin 두 키뿐이다. 부분 참석자
 * '퇴장 5분 전 알림'은 상태가 아니라 표시 전용 안내 — 확정하면 '함께 챙긴 것'에 자동으로 담긴다.
 * 토글 상태는 슬롯이 바뀌어도 남을 수 있으므로 activeMitigations로 항상 슬롯 맥락과
 * 교집합해 쓴다(파생 유효성 — find의 activeId와 같은 규칙).
 *
 * 회의 장소: availableRooms(조정 반영 시간·전체 인원) 실측 목록. 자동 선택 없음 —
 * 딱 맞는(정원 여유 최소) 방에 '추천' Badge만 붙인다. '화상으로 진행'은 항상 마지막에
 * 있고(방 0개면 여기에 추천), 시간 조정으로 목록이 바뀌면 FLIP. room 또는 remote를
 * 골라야 CTA가 산다 — 선택한 방이 조정으로 사라지면 선택도 자연히 무효가 된다.
 */

// ── 순수 헬퍼(테스트 대상) ─────────────────────────────────────────

export interface Mitigations {
  delayTen: boolean;
  fiftyMin: boolean;
}

/** 완화 토글 노출 조건 — 슬롯의 실제 긴장(reasons)에서만 파생한다. */
export function mitigationOptions(slot: Pick<CandidateSlot, 'reasons' | 'start' | 'end'>): Mitigations {
  return {
    delayTen: slot.reasons.some((r) => r.code === 'after-lunch'),
    // '50분 회의'는 줄여서 배려하는 제안 — 원래 길이가 50분 이하면 성립하지 않는다.
    fiftyMin: slot.reasons.some((r) => r.code === 'back-to-back') && slot.end - slot.start > 50,
  };
}

/**
 * 실제로 적용되는 완화 — 토글 상태는 슬롯이 바뀌어도 reducer에 남을 수 있으므로,
 * 이 슬롯이 그 완화를 제안하는 경우에만 유효한 것으로 본다(파생 무효화).
 */
export function activeMitigations(
  slot: Pick<CandidateSlot, 'reasons' | 'start' | 'end'>,
  m: Mitigations,
): Mitigations {
  const opts = mitigationOptions(slot);
  return { delayTen: m.delayTen && opts.delayTen, fiftyMin: m.fiftyMin && opts.fiftyMin };
}

/** 완화 반영 시간 — delayTen은 시작·끝 +10분, fiftyMin은 (늦춘) 시작부터 50분으로 마친다. */
export function adjustedRange(
  slot: { start: Minutes; end: Minutes },
  m: Mitigations,
): { start: Minutes; end: Minutes } {
  const start = slot.start + (m.delayTen ? 10 : 0);
  const end = m.fiftyMin ? start + 50 : slot.end + (m.delayTen ? 10 : 0);
  return { start, end };
}

/** 확정 직전 정직함 — 선택 슬롯의 긴장 라인(비positive)만 1~2줄 재노출한다. */
export function tensionLines(reasons: SlotReason[]): SlotReason[] {
  return reasons.filter((r) => r.tone !== 'positive').slice(0, 2);
}

/** '딱 맞는' 방 — 정원 여유(capacity − headcount)가 최소인 방의 id. 동률이면 앞쪽, 없으면 null. */
export function bestRoomId(rooms: Pick<Room, 'id' | 'capacity'>[], headcount: number): string | null {
  let best: string | null = null;
  let slack = Infinity;
  for (const r of rooms) {
    const s = r.capacity - headcount;
    if (s >= 0 && s < slack) {
      best = r.id;
      slack = s;
    }
  }
  return best;
}

/** 분 → '30분' / '50분' / '1시간' / '1시간 30분'. */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// ── 작은 조각들 ────────────────────────────────────────────────────

/** 위치 이동 스프링 — FLIP 재정렬(리스트·토스트와 같은 {350, 30} 규칙). */
const POSITION_SPRING = { type: 'spring' as const, stiffness: 350, damping: 30 };

function MitigationToggle({
  label,
  sub,
  checked,
  onToggle,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-[1.4] text-text-strong">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-[1.4] text-text-weak">{sub}</span>
      </span>
      {/* 스위치 — transform·색만 애니메이션(컴포지터 전용) */}
      <span
        aria-hidden
        className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-300 ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          className={`absolute left-0 top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(25,31,40,0.2)] transition-transform duration-300 ${
            checked ? 'translate-x-[21px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
    </button>
  );
}

/** 장소 한 줄 — 방/화상 공용. 자동 선택 없음, 탭이 곧 선택(SET_ROOM). */
function PlaceRow({
  title,
  sub,
  selected,
  recommended,
  remote = false,
  onSelect,
}: {
  title: string;
  sub: string;
  selected: boolean;
  recommended: boolean;
  remote?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`pressable flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left transition-shadow ${
        selected ? 'ring-[1.5px] ring-primary/60' : 'ring-1 ring-border/70'
      }`}
    >
      {remote && <Video size={18} aria-hidden className="shrink-0 text-text-weak" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-text-strong">{title}</span>
          {recommended && <Badge tone="rec">추천</Badge>}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-text-weak">{sub}</span>
      </span>
      {selected && <Check size={17} strokeWidth={2.6} aria-hidden className="shrink-0 text-primary" />}
    </button>
  );
}

// ── 본체 ────────────────────────────────────────────────────────────

export interface ConfirmStepProps {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export default function ConfirmStep({ state, dispatch }: ConfirmStepProps) {
  const reduced = !!useReducedMotion();
  const candidates = useCandidates(state);
  const slot = candidates.slots.find((s) => s.id === state.selectedSlotId) ?? null;

  // 딥링크 가드 — 선택 슬롯이 현재 조건에서 유효하지 않으면 정직하게 되돌린다.
  if (!slot) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-5 px-4">
        <Reveal className="w-full rounded-card bg-section px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-text-strong">선택한 시간을 찾을 수 없어요</p>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-text-weak">조건이 바뀌었나 봐요 — 다시 골라주세요</p>
        </Reveal>
        <Reveal delay={70}>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'find' })}
            className="pressable inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-semibold text-text-body ring-1 ring-border"
          >
            시간 다시 찾기
          </button>
        </Reveal>
      </main>
    );
  }

  const { attendees } = candidates;
  const opts = mitigationOptions(slot);
  const active = activeMitigations(slot, state.mitigations);
  const adj = adjustedRange(slot, active);
  const tension = tensionLines(slot.reasons);

  // 회의 장소 — 조정 반영 시간·전체 인원(부분 참석자도 좌석 차지)으로 실측.
  const headcount = attendees.length;
  const rooms = availableRooms(ROOMS, slot.day, adj.start, adj.end, headcount);
  const recommendedId = bestRoomId(rooms, headcount);
  // 파생 유효성 — 시간 조정으로 방이 사라지면 그 선택은 낡은 것이다.
  const chosen =
    state.roomId === 'remote' ? 'remote' : rooms.some((r) => r.id === state.roomId) ? state.roomId : null;

  const offsiteWho = slot.reasons.find((r) => r.code === 'offsite-day')?.who;
  const offsiteName = offsiteWho ? attendees.find((a) => a.id === offsiteWho)?.name ?? null : null;

  const confirmMeeting = () => {
    if (chosen === null) return;
    const roomName = chosen === 'remote' ? '화상' : rooms.find((r) => r.id === chosen)?.name;
    dispatch({ type: 'CONFIRM', event: { day: slot.day, start: adj.start, end: adj.end, room: roomName } });
  };

  const hasMitigationSection = opts.delayTen || opts.fiftyMin || slot.partials.length > 0;

  return (
    <main className="min-h-dvh bg-bg pb-44">
      {/* 데스크톱 헤더 — 홈·셋업·찾기와 같은 오로라·워드마크 틀(스텝이 바뀌어도 유지). */}
      <div className="relative hidden lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Aurora variant="home" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </div>
        <div className="relative mx-auto max-w-[1200px] px-6 py-4">
          <header className="flex h-10 items-center">
            <Wordmark />
          </header>
        </div>
      </div>

      {/* 헤더 — 뒤로가기 → find. 상시 frost(전 화면 공통 문법). */}
      <FrostedBar innerClassName="mx-auto w-full max-w-[560px] px-4">
        <Reveal as="header" className="-mx-1 flex h-14 items-center">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'find' })}
            aria-label="뒤로"
            className="pressable -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-text-strong hover:bg-section"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        </Reveal>
      </FrostedBar>
      <div className="mx-auto w-full max-w-[560px] px-4">

        {/* 타이틀 + 서브 */}
        <Reveal delay={70} className="pt-2 lg:pt-0">
          <h1 className="text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong lg:text-[24px]">
            {fmtDayKorean(slot.day)} {fmtTime(adj.start)}, 이렇게 잡을까요?
          </h1>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-text-weak">
            {state.title.trim() || '회의'} · {fmtDuration(adj.end - adj.start)} · {attendees.length}명
          </p>
        </Reveal>

        {/* 선택 슬롯 요약 — 시간 + 긴장 라인 재노출(확정 직전 정직함) */}
        <Reveal delay={140} className="pt-4">
          <section className="rounded-card bg-white p-4 shadow-[0_2px_12px_rgba(25,31,40,0.05)] ring-1 ring-border/70">
            <p className="text-[12px] font-medium text-text-weak">{fmtDayKorean(slot.day)}</p>
            {/* 완화 토글이 시간을 옮기면 이 줄이 그 자리에서 갱신된다 */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={`${adj.start}-${adj.end}`}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mt-0.5 text-[20px] font-bold tracking-[-0.01em] text-text-strong"
              >
                {fmtRange(adj.start, adj.end)}
              </motion.p>
            </AnimatePresence>
            {tension.length > 0 && (
              <div className="mt-3">
                <ReasonCard.Reasons reasons={tension} animated={!reduced} />
              </div>
            )}
          </section>
        </Reveal>

        {/* 모두를 위한 조정 — 이 슬롯이 실제로 가진 긴장에만 반응한다 */}
        {hasMitigationSection && (
          <Reveal delay={210} className="pt-6">
            <p className="text-[14px] font-semibold text-text-strong">모두를 위한 조정</p>
            <div className="mt-2.5 divide-y divide-border/60 rounded-card bg-white shadow-[0_2px_12px_rgba(25,31,40,0.05)] ring-1 ring-border/70">
              {opts.delayTen && (
                <MitigationToggle
                  label="10분 늦춰 시작해 여유를 둘까요?"
                  sub={`${fmtTime(slot.start)} → ${fmtTime(slot.start + 10)} 시작`}
                  checked={state.mitigations.delayTen}
                  onToggle={() => dispatch({ type: 'TOGGLE_MITIGATION', key: 'delayTen' })}
                />
              )}
              {opts.fiftyMin && (
                <MitigationToggle
                  label="50분 회의로 다음 일정 배려"
                  sub={`${fmtTime(adjustedRange(slot, { ...active, fiftyMin: true }).end)}에 마쳐요`}
                  checked={state.mitigations.fiftyMin}
                  onToggle={() => dispatch({ type: 'TOGGLE_MITIGATION', key: 'fiftyMin' })}
                />
              )}
              {/* 퇴장 알림 — 상태가 아니라 약속. 확정하면 '함께 챙긴 것'에 자동으로 담긴다. */}
              {slot.partials.map((p) => {
                const name = attendees.find((a) => a.id === p.attendeeId)?.name ?? p.attendeeId;
                return (
                  <div key={p.attendeeId} className="flex w-full items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold leading-[1.4] text-text-strong">
                        {name}님 퇴장 5분 전 알림
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-[1.4] text-text-weak">
                        &lsquo;함께 챙긴 것&rsquo;에 자동으로 담겨요
                      </span>
                    </span>
                    <Badge tone="ok">자동 포함</Badge>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* 회의 장소 — 자동 선택 없음, 추천 Badge만. 시간이 바뀌면 목록이 FLIP으로 다시 선다. */}
        <Reveal delay={hasMitigationSection ? 280 : 210} className="pt-6">
          <p className="text-[14px] font-semibold text-text-strong">어디서 할까요?</p>
          <LayoutGroup>
            <ul className="mt-2.5 space-y-2">
              <AnimatePresence initial={false} mode="popLayout">
                {rooms.map((room) => (
                  <motion.li
                    key={room.id}
                    layout={reduced ? false : 'position'}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                    transition={POSITION_SPRING}
                  >
                    <PlaceRow
                      title={room.name}
                      sub={`정원 ${room.capacity}명 · ${room.floorNote}`}
                      selected={chosen === room.id}
                      recommended={recommendedId === room.id}
                      onSelect={() => dispatch({ type: 'SET_ROOM', roomId: room.id })}
                    />
                  </motion.li>
                ))}
                <motion.li key="remote" layout={reduced ? false : 'position'} transition={POSITION_SPRING}>
                  <PlaceRow
                    remote
                    title="화상으로 진행"
                    sub={offsiteName ? `${offsiteName}님 외근 대비 링크 포함` : '어디서든 참여할 수 있어요'}
                    selected={chosen === 'remote'}
                    recommended={rooms.length === 0}
                    onSelect={() => dispatch({ type: 'SET_ROOM', roomId: 'remote' })}
                  />
                </motion.li>
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        </Reveal>
      </div>

      {/* 하단 고정 CTA — 장소를 골라야 산다(회의는 어딘가에서 열린다) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-4 pt-6"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {/* 하단 frost — 요약·장소 카드가 반투명 너머로 흐릿하게 지나간다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent"
        />
        <div className="relative mx-auto max-w-[560px]">
          {chosen === null && (
            <p className="pb-2 text-center text-[12px] font-medium text-text-weak">회의 장소를 골라주세요</p>
          )}
          <button
            type="button"
            onClick={confirmMeeting}
            disabled={chosen === null}
            className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white transition-colors active:bg-primary-pressed disabled:bg-section disabled:text-text-faint"
          >
            이 시간으로 확정할게요
          </button>
        </div>
      </div>
    </main>
  );
}
