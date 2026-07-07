'use client';

import { useState, type Dispatch } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { CalendarDays, ChevronDown, ChevronLeft, List } from 'lucide-react';
import Avatar from './Avatar';
import CandidateGrid from './CandidateGrid';
import Chip from './Chip';
import ReasonCard from './ReasonCard';
import Reveal from './Reveal';
import { useCandidates } from '../app-state/useCandidates';
import type { Action, AppState } from '../app-state/reducer';
import { ME_ID } from '../data/world';
import type { DeadlineKind } from '../lib/types';

/**
 * 시간 찾기 — 모바일 추천 리스트(히어로 1/2). 추천은 점수가 아니라 사람의 상황으로 말한다.
 *
 * 구조: 헤더(타이틀+조건 요약) → 조건 디스클로저(길이·기한·꼭/선택 — 바꾸면 즉시 재계산)
 * → 추천 카드 5장(ReasonCard, 탭=그 자리 확장) ↔ 시간표 토글(CandidateGrid, 밴드 탭=선택)
 * → 하단 고정 CTA '이 시간으로 할게요'(확장/선택된 후보가 있을 때만).
 *
 * FLIP: LayoutGroup + layout="position" — 조건 변경 시 남는 카드는 스프링 {350,30}으로
 * 자리를 바꾸고, 사라지는/새 카드는 popLayout으로 페이드. 로딩 상태 없음(순수 동기 재계산).
 * 카드 확장은 layout이 아니라 카드 내부 height 트윈 — 아래 카드는 문서 흐름으로 밀린다.
 *
 * 빈 상태(후보 0)는 임시 카드 — 결정 모먼트(T17)가 교체한다.
 * 데스크톱(lg+)도 당분간 이 화면을 560px 중앙으로 그대로 쓴다(T16이 교체).
 */

const DURATION_OPTIONS: { value: 30 | 60 | 90; label: string }[] = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 90, label: '1시간 30분' },
];
const DEADLINE_OPTIONS: { value: DeadlineKind; label: string }[] = [
  { value: 'this-week', label: '이번 주 안에' },
  { value: 'next-week', label: '다음 주까지' },
  { value: 'flexible', label: '여유 있어요' },
];
const DURATION_LABEL = Object.fromEntries(DURATION_OPTIONS.map((o) => [o.value, o.label])) as Record<
  30 | 60 | 90,
  string
>;
const DEADLINE_LABEL = Object.fromEntries(DEADLINE_OPTIONS.map((o) => [o.value, o.label])) as Record<
  DeadlineKind,
  string
>;

/** 위치 이동 스프링 — FLIP 재정렬(셋업 폼·토스트와 같은 {350, 30} 규칙). */
const POSITION_SPRING = { type: 'spring' as const, stiffness: 350, damping: 30 };
/** 디스클로저 개폐 — 셋업 모핑과 같은 expo-out 한 호흡. */
const DISCLOSE = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const };

export interface FindTimeMobileProps {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export default function FindTimeMobile({ state, dispatch }: FindTimeMobileProps) {
  const reduced = !!useReducedMotion();
  const { attendees, windowDays, slots, visible } = useCandidates(state);
  // 확장된(=지금 보고 있는) 후보 — 딥링크의 선택을 이어받고, 조건이 바뀌어 목록에서
  // 사라지면 자연히 무효가 된다(visible 검증으로 파생 — effect 없음).
  const [expandedId, setExpandedId] = useState<string | null>(() => state.selectedSlotId);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [condOpen, setCondOpen] = useState(false);

  const activeId = expandedId !== null && visible.some((s) => s.id === expandedId) ? expandedId : null;
  const requiredCount = attendees.filter((a) => a.attendanceType === 'required').length;
  const optionalCount = attendees.length - requiredCount;

  const toggleCard = (id: string) => setExpandedId((cur) => (cur === id ? null : id));
  const selectFromGrid = (id: string) => {
    setExpandedId(id);
    dispatch({ type: 'SELECT_SLOT', slotId: id }); // 밴드 탭 = 선택 — 리스트 복귀에도 유지
  };
  const confirm = () => {
    if (activeId === null) return;
    dispatch({ type: 'SELECT_SLOT', slotId: activeId });
    dispatch({ type: 'SET_STEP', step: 'confirm' });
  };

  return (
    <div className="pb-36">
      <div className="mx-auto w-full max-w-[560px] px-4">
        {/* 헤더 — 뒤로가기 → 셋업 */}
        <Reveal as="header" className="-mx-1 flex h-14 items-center">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'setup' })}
            className="pressable -ml-1 flex h-10 items-center gap-1 rounded-full pl-1.5 pr-3 text-[15px] font-semibold text-text-strong hover:bg-section"
          >
            <ChevronLeft size={20} aria-hidden />
            일정 만들기
          </button>
        </Reveal>

        {/* 타이틀 + 조건 요약 */}
        <Reveal delay={70} className="pt-2">
          <h1 className="text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong">
            모두를 생각한 {DURATION_LABEL[state.duration]}이에요
          </h1>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-text-weak">
            {DEADLINE_LABEL[state.deadline]} · 필수 {requiredCount}명 · 선택 {optionalCount}명 · 후보 {slots.length}개
          </p>
        </Reveal>

        {/* 조건 디스클로저 — 여기서 바꾸면 아래 리스트가 즉시 다시 선다 */}
        <Reveal delay={140} className="pt-4">
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-border/70">
            <button
              type="button"
              aria-expanded={condOpen}
              onClick={() => setCondOpen((v) => !v)}
              className="flex h-12 w-full items-center justify-between px-4 text-left"
            >
              <span className="text-[14px] font-medium text-text-strong">
                조건 · {DURATION_LABEL[state.duration]} · {DEADLINE_LABEL[state.deadline]}
              </span>
              <ChevronDown
                size={16}
                aria-hidden
                className={`text-text-weak transition-transform duration-300 ${condOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {condOpen && (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={DISCLOSE}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-3.5">
                    <div>
                      <p className="text-[12px] font-semibold text-text-weak">회의 길이</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DURATION_OPTIONS.map((o) => (
                          <Chip
                            key={o.value}
                            selected={state.duration === o.value}
                            onClick={() => dispatch({ type: 'SET_DURATION', duration: o.value })}
                          >
                            {o.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-text-weak">언제까지</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DEADLINE_OPTIONS.map((o) => (
                          <Chip
                            key={o.value}
                            selected={state.deadline === o.value}
                            onClick={() => dispatch({ type: 'SET_DEADLINE', deadline: o.value })}
                          >
                            {o.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-text-weak">참석자</p>
                      <div className="mt-1">
                        {attendees.map((p) => {
                          const isMe = p.id === ME_ID;
                          const required = p.attendanceType === 'required';
                          return (
                            <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                              <Avatar person={p} size={28} />
                              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-text-strong">
                                {p.name}
                                {isMe && <span className="ml-1.5 text-[12px] font-normal text-text-weak">나 · 주최자</span>}
                              </span>
                              {!isMe && (
                                <button
                                  type="button"
                                  aria-pressed={required}
                                  aria-label={`${p.name} ${required ? '꼭 참석' : '선택 참석'}`}
                                  onClick={() => dispatch({ type: 'SET_REQUIRED', id: p.id, required: !required })}
                                  className={`pressable h-7 shrink-0 rounded-full px-2.5 text-[12px] font-semibold transition-colors ${
                                    required ? 'bg-primary-tint text-primary' : 'bg-section text-text-weak'
                                  }`}
                                >
                                  {required ? '꼭 참석' : '선택'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>

        {/* 뷰 헤더 + 시간표 토글 */}
        <Reveal delay={210} className="flex items-center justify-between pb-2 pt-5">
          <p className="text-[13px] font-semibold text-text-weak">
            {view === 'list' ? '추천 순이에요' : '주간 시간표예요'}
          </p>
          <button
            type="button"
            onClick={() => setView((v) => (v === 'list' ? 'grid' : 'list'))}
            className="pressable flex h-8 items-center gap-1.5 rounded-full bg-section px-3 text-[13px] font-medium text-text-body"
          >
            {view === 'list' ? (
              <>
                <CalendarDays size={14} aria-hidden />
                시간표로 보기
              </>
            ) : (
              <>
                <List size={14} aria-hidden />
                리스트로 보기
              </>
            )}
          </button>
        </Reveal>

        <Reveal delay={280}>
          {slots.length === 0 ? (
            /* 빈 상태(임시) — T17 결정 모먼트가 이 자리를 채운다 */
            <div className="rounded-card bg-section px-6 py-12 text-center">
              <p className="text-[15px] font-semibold text-text-strong">이 조건으로는 시간이 없어요</p>
              <p className="mt-1.5 text-[13px] leading-[1.5] text-text-weak">곧 도와드릴게요</p>
            </div>
          ) : view === 'grid' ? (
            <CandidateGrid
              slots={visible}
              windowDays={windowDays}
              attendees={attendees}
              selectedId={activeId}
              onSelect={selectFromGrid}
            />
          ) : (
            <LayoutGroup>
              <ul className="space-y-2.5">
                <AnimatePresence initial={false} mode="popLayout">
                  {visible.map((slot, i) => (
                    <motion.li
                      key={slot.id}
                      layout={reduced ? false : 'position'}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                      transition={POSITION_SPRING}
                    >
                      <ReasonCard
                        slot={slot}
                        attendees={attendees}
                        windowDays={windowDays}
                        expanded={activeId === slot.id}
                        recommended={i === 0}
                        onSelect={() => toggleCard(slot.id)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}
        </Reveal>
      </div>

      {/* 하단 고정 CTA — 보고 있는 후보가 있을 때만 산다 */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pt-6"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-[560px]">
          <button
            type="button"
            onClick={confirm}
            disabled={activeId === null}
            className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white transition-colors active:bg-primary-pressed disabled:bg-section disabled:text-text-faint"
          >
            이 시간으로 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
