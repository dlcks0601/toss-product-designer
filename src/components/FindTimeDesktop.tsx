'use client';

import { useCallback, useMemo, useRef, useState, type Dispatch } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, X } from 'lucide-react';
import Aurora from './Aurora';
import Avatar from './Avatar';
import Chip from './Chip';
import Wordmark from './Wordmark';
import DecisionMoment, { decisionKey, pickAction } from './DecisionMoment';
import ReasonCard from './ReasonCard';
import Reveal from './Reveal';
import WeekCanvas from './WeekCanvas';
import { DEADLINE_LABEL, DEADLINE_OPTIONS, DURATION_LABEL, DURATION_OPTIONS } from './FindTimeMobile';
import { mondayOf, weekIndexOf, weekLabel, weekMondays } from './MiniLocator';
import { fmtDayKorean, fmtTime } from '../lib/time';
import { ME_ID } from '../data/world';
import type { Candidates } from '../app-state/useCandidates';
import type { Action, AppState } from '../app-state/reducer';
import type { RelaxationSuggestion } from '../lib/relaxation';

/**
 * 시간 찾기 — PC(lg+) 지도 앱 패턴(히어로 2/2). 캘린더 캔버스가 지도, 이유 카드가 장소 카드다.
 *
 * 3영역: 좌 조건 패널(240 고정 — 길이·기한·꼭/선택, 바꾸면 즉시 재계산) / 중앙 WeekCanvas
 * (팀 밀도 지형 + 후보 밴드) / 우 이유 카드 레일(340 고정, visible 5장 + 하단 CTA).
 *
 * 상호 하이라이트의 단일 상태: hoveredId 하나를 레일 카드와 캔버스 밴드가 공유한다 —
 * 카드 호버 → 밴드 글로우, 밴드 호버 → 카드 링(둘 다 opacity 150~200ms ease-out).
 * 클릭 동기: 밴드 탭 = 선택 + 카드 확장 + 스크롤 인뷰 / 카드 탭 = 확장 + 밴드 솔리드.
 * 선택은 모바일과 같은 파생 규칙 — activeId는 visible 멤버십으로 검증(조건 변경 시 자동 무효).
 *
 * 주 스위처: 기한 창이 2주 이상이면 '이번 주 남은 날 | 다음 주 (| 그다음 주)' 세그먼트.
 * 키보드 ←→ 순회로 다른 주의 후보가 선택되면 주도 따라간다. 공지는 aria-live 하나로.
 *
 * 결정 모먼트(T17): 후보 0이면 레일 자리에 단독(캔버스는 팀 밀도 지형으로 남는다),
 * 전부 warning이면 레일 카드 위에 먼저 + 아래 카드 흐림. '한 번만' 규칙은 모바일과 동일 —
 * decisionKey로 응답한 조합을 기억하고, 조건 패널 직접 조작도 유효한 응답으로 친다.
 */

export interface FindTimeDesktopProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  candidates: Candidates;
}

export default function FindTimeDesktop({ state, dispatch, candidates }: FindTimeDesktopProps) {
  const reduced = !!useReducedMotion();
  const { attendees, windowDays, slots, visible, needsDecision, suggestions, bottleneck } = candidates;

  const [selectedId, setSelectedId] = useState<string | null>(() => state.selectedSlotId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  // 결정 모먼트 '한 번만' 규칙 — 응답한 조건 조합의 해시. 세션 로컬(URL 비직렬화).
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  const mondays = useMemo(() => weekMondays(windowDays), [windowDays]);
  // 첫 화면은 1위 후보가 있는 주 — 캔버스를 연 이유가 대개 그 후보의 맥락이다.
  const [weekRaw, setWeekRaw] = useState(() =>
    Math.max(weekIndexOf(visible[0]?.day ?? windowDays[0] ?? '', windowDays), 0),
  );
  const week = Math.min(weekRaw, mondays.length - 1);
  const days = useMemo(
    () => windowDays.filter((d) => mondayOf(d) === mondays[week]),
    [windowDays, mondays, week],
  );

  // 파생 유효성 — 조건이 바뀌어 목록에서 사라진 선택은 자연히 무효(effect 없음).
  const activeId = selectedId !== null && visible.some((s) => s.id === selectedId) ? selectedId : null;
  const requiredCount = attendees.filter((a) => a.attendanceType === 'required').length;
  const optionalCount = attendees.length - requiredCount;

  const condKey = decisionKey(state);
  const showMoment = needsDecision && condKey !== answeredKey;
  const allowedPartial =
    state.allowPartialRequiredId !== null
      ? attendees.find((a) => a.id === state.allowPartialRequiredId) ?? null
      : null;

  /** 제안 선택 = 이 조건 조합에 대한 응답 — 기록 후 kind별 조건 변화를 dispatch(재계산은 useCandidates가). */
  const pickSuggestion = (s: RelaxationSuggestion) => {
    setAnsweredKey(condKey);
    const action = pickAction(s, state.deadline);
    if (action) dispatch(action);
  };
  /** 조건 패널 직접 조작도 유효한 응답 — 응답 기록을 비워 다음 막다른 조합에서 다시 도울 수 있게 한다. */
  const touchCondition = (action: Action) => {
    setAnsweredKey(null);
    dispatch(action);
  };

  /** 밴드 탭·키보드 공용 선택 — 주 전환 + 카드 확장 + 스크롤 인뷰 + 공지까지 한 손에. */
  const selectSlot = useCallback(
    (id: string) => {
      const slot = visible.find((s) => s.id === id);
      if (!slot) return;
      setSelectedId(id);
      dispatch({ type: 'SELECT_SLOT', slotId: id });
      const w = weekIndexOf(slot.day, windowDays);
      if (w >= 0) setWeekRaw(w);
      setAnnounce(`${fmtDayKorean(slot.day)} ${fmtTime(slot.start)} 선택됨`);
      cardRefs.current.get(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    },
    [visible, windowDays, dispatch, reduced],
  );

  /** 카드 탭 — 확장 토글 + 밴드 솔리드 동기(접으면 선택도 내려놓는다). */
  const toggleCard = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }
    const slot = visible.find((s) => s.id === id);
    if (!slot) return;
    setSelectedId(id);
    const w = weekIndexOf(slot.day, windowDays);
    if (w >= 0) setWeekRaw(w);
    setAnnounce(`${fmtDayKorean(slot.day)} ${fmtTime(slot.start)} 선택됨`);
  };

  const confirm = useCallback(() => {
    if (activeId === null) return;
    dispatch({ type: 'SELECT_SLOT', slotId: activeId });
    dispatch({ type: 'SET_STEP', step: 'confirm' });
  }, [activeId, dispatch]);

  const hover = useCallback((id: string | null) => setHoveredId(id), []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* 데스크톱 헤더 — 셋업·홈과 같은 오로라·워드마크. 스텝이 바뀌어도 페이지 틀은 유지된다. */}
      <div className="relative shrink-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Aurora variant="home" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </div>
        <div className="relative mx-auto w-full max-w-[1200px] px-6 py-4">
          <header className="flex items-center">
            <Wordmark />
          </header>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col overflow-hidden px-6">
        {/* 헤더 — 뒤로가기 → 셋업 */}
        <Reveal as="header" className="flex h-14 shrink-0 items-center">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'setup' })}
            aria-label="뒤로"
            className="pressable -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-text-strong hover:bg-section"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        </Reveal>

        {/* 고정 영역(헤더·타이틀) 아래 은은한 셰이드 — 캔버스가 밑으로 지나가는 느낌.
            내부 스크롤 구조라 창 스크롤 frosted 대신 정적 그라디언트를 쓴다. */}
        {/* 타이틀·서브(모바일과 동일 카피) + 주 스위처 */}
        <Reveal delay={70} className="flex shrink-0 items-end justify-between pb-4 pt-1">
          <div>
            <h1 className="text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong">
              모두를 생각한 {DURATION_LABEL[state.duration]}이에요
            </h1>
            <p className="mt-1 text-[13px] leading-[1.5] text-text-weak">
              {DEADLINE_LABEL[state.deadline]} · 필수 {requiredCount}명 · 선택 {optionalCount}명 · 후보 {slots.length}개
            </p>
          </div>
          {mondays.length > 1 && (
            <div className="flex rounded-full bg-section p-1">
              {mondays.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={week === i}
                  onClick={() => setWeekRaw(i)}
                  className={`pressable h-8 rounded-full px-3.5 text-[13px] transition-colors ${
                    week === i
                      ? 'bg-white font-semibold text-text-strong shadow-[0_1px_4px_rgba(25,31,40,0.1)]'
                      : 'font-medium text-text-weak'
                  }`}
                >
                  {i === 0 ? '이번 주 남은 날' : weekLabel(i)}
                </button>
              ))}
            </div>
          )}
        </Reveal>

        <div className="flex min-h-0 flex-1 gap-5 pb-6">
          {/* ── 좌: 조건 패널(240 고정) — 바꾸면 캔버스·레일이 동시에 다시 선다 ── */}
          <Reveal delay={140} as="aside" className="w-[240px] shrink-0 overflow-y-auto">
            <div className="rounded-[20px] bg-white p-4 ring-1 ring-border/70">
              <p className="text-[12px] font-semibold text-text-weak">회의 길이</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    selected={state.duration === o.value}
                    onClick={() => touchCondition({ type: 'SET_DURATION', duration: o.value })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-5 text-[12px] font-semibold text-text-weak">언제까지</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEADLINE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    selected={state.deadline === o.value}
                    onClick={() => touchCondition({ type: 'SET_DEADLINE', deadline: o.value })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-5 text-[12px] font-semibold text-text-weak">참석자</p>
              <div className="mt-1">
                {attendees.map((p) => {
                  const isMe = p.id === ME_ID;
                  const required = p.attendanceType === 'required';
                  return (
                    <div key={p.id} className="flex items-center gap-2 py-1.5">
                      <Avatar person={p} size={24} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-strong">
                        {p.name}
                        {isMe && <span className="ml-1 text-[11px] font-normal text-text-weak">나</span>}
                      </span>
                      {!isMe && (
                        <button
                          type="button"
                          aria-pressed={required}
                          aria-label={`${p.name} ${required ? '꼭 참석' : '선택 참석'}`}
                          onClick={() => touchCondition({ type: 'SET_REQUIRED', id: p.id, required: !required })}
                          className={`pressable h-6 shrink-0 rounded-full px-2 text-[11px] font-semibold transition-colors ${
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
              {/* 허락제 상태 칩 — 몰래가 아니라 명시적 상태. 탭 = 해제(유효한 응답). */}
              {allowedPartial && (
                <button
                  type="button"
                  onClick={() => touchCondition({ type: 'ALLOW_PARTIAL', id: null })}
                  aria-label={`${allowedPartial.name}님 부분 참석 허용 해제`}
                  className="pressable mt-3 inline-flex h-8 items-center gap-1 rounded-full bg-primary-tint pl-3 pr-2 text-[12px] font-semibold text-primary"
                >
                  {allowedPartial.name}님 부분 참석 허용됨
                  <X size={13} aria-hidden />
                </button>
              )}
            </div>
          </Reveal>

          {/* ── 중앙: 주간 캔버스 — 밀도 지형 + 후보 밴드 ── */}
          <Reveal delay={210} className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <WeekCanvas
                days={days}
                attendees={attendees}
                candidates={visible}
                selectedId={activeId}
                hoveredId={hoveredId}
                title={state.title.trim()}
                onHover={hover}
                onSelect={selectSlot}
                onConfirm={confirm}
                reduced={reduced}
              />
            </div>
            <p className="mt-2 shrink-0 text-center text-[11px] text-text-faint">
              회색이 진할수록 바쁜 사람이 많아요 · 파란 밴드가 추천 시간이에요
            </p>
          </Reveal>

          {/* ── 우: 이유 카드 레일(340 고정) + 하단 CTA ── */}
          <Reveal delay={280} as="aside" className="flex w-[340px] shrink-0 flex-col">
            {slots.length > 0 && (
              <p className="shrink-0 pb-2 text-[13px] font-semibold text-text-weak">추천 순이에요</p>
            )}
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2 pt-0.5">
              {slots.length === 0 ? (
                /* 빈 상태 — 결정 모먼트 단독. 이미 응답한 조합이면 조용한 안내만. */
                showMoment ? (
                  <DecisionMoment
                    key={condKey}
                    suggestions={suggestions}
                    bottleneck={bottleneck}
                    mode="empty"
                    deadline={state.deadline}
                    onPick={pickSuggestion}
                  />
                ) : (
                  <div className="rounded-card bg-section px-6 py-12 text-center">
                    <p className="text-[15px] font-semibold text-text-strong">이 조건으로는 시간이 없어요</p>
                    <p className="mt-1.5 text-[13px] leading-[1.5] text-text-weak">조건을 바꾸면 바로 다시 찾아볼게요</p>
                  </div>
                )
              ) : (
                <>
                  {/* 전부 아쉬움 — 결정 모먼트 먼저, 아래 후보는 흐리게(그래도 답이 될 수 있으니 남긴다) */}
                  {showMoment && (
                    <div className="pb-2.5">
                      <DecisionMoment
                        key={condKey}
                        suggestions={suggestions}
                        bottleneck={bottleneck}
                        mode="all-warning"
                        deadline={state.deadline}
                        onPick={pickSuggestion}
                      />
                    </div>
                  )}
                  <div className={showMoment ? 'opacity-50' : undefined}>
                    <LayoutGroup>
                      <ul className="space-y-2.5">
                        <AnimatePresence initial={false} mode="popLayout">
                          {visible.map((slot, i) => (
                            <motion.li
                              key={slot.id}
                              ref={(el) => {
                                if (el) cardRefs.current.set(slot.id, el);
                                else cardRefs.current.delete(slot.id);
                              }}
                              layout={reduced ? false : 'position'}
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            >
                              <div
                                className="relative rounded-card"
                                onMouseEnter={() => hover(slot.id)}
                                onMouseLeave={() => hover(null)}
                              >
                                <ReasonCard
                                  slot={slot}
                                  attendees={attendees}
                                  windowDays={windowDays}
                                  expanded={activeId === slot.id}
                                  recommended={i === 0}
                                  onSelect={() => toggleCard(slot.id)}
                                />
                                {/* 상호 하이라이트 링 — 밴드 호버가 이 카드를 가리킨다(opacity만). */}
                                <span
                                  aria-hidden
                                  className={`pointer-events-none absolute -inset-[2px] rounded-[18px] ring-2 ring-primary/50 transition-opacity duration-200 ease-out ${
                                    hoveredId === slot.id ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                              </div>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    </LayoutGroup>
                  </div>
                </>
              )}
            </div>
            <div className="shrink-0 pt-3">
              {state.selectedSlotId !== null && state.selectedSlotId === state.confirmedSlotId ? (
                /* 확정 후 되돌아온 경우 — 이미 잡힌 회의를 다시 잡게 하지 않는다(상태 일관). */
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_STEP', step: 'home' })}
                  className="pressable h-[54px] w-full rounded-2xl bg-primary-tint text-[16px] font-semibold text-primary"
                >
                  확정됨 · 내 캘린더에서 보기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={activeId === null}
                  className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white transition-colors active:bg-primary-pressed disabled:bg-section disabled:text-text-faint"
                >
                  이 시간으로 할게요
                </button>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      {/* 선택 공지 — 키보드 순회·탭 어느 경로든 같은 문장으로 */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
