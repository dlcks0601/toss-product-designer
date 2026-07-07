'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import { useReducedMotion } from 'motion/react';
import Aurora from '../components/Aurora';
import ConfirmStep from '../components/ConfirmStep';
import DoneStep from '../components/DoneStep';
import FindTimeDesktop from '../components/FindTimeDesktop';
import FindTimeMobile from '../components/FindTimeMobile';
import HomeCalendar from '../components/HomeCalendar';
import InviteCard from '../components/InviteCard';
import InviteView from '../components/InviteView';
import NotificationBell from '../components/NotificationBell';
import Reveal from '../components/Reveal';
import ScanMoment from '../components/ScanMoment';
import SetupForm from '../components/SetupForm';
import TaskCard from '../components/TaskCard';
import ToastStack from '../components/ToastStack';
import WelcomeCard from '../components/WelcomeCard';
import Wordmark from '../components/Wordmark';
import { playResponseScript, useNotifications } from '../app-state/notifications';
import { fromUrl, initialState, reducer, toUrl } from '../app-state/reducer';
import { useCandidates } from '../app-state/useCandidates';
import { useIsDesktop } from '../app-state/useIsDesktop';
import type { Action, AppState } from '../app-state/reducer';
import type { ResponseBadges } from '../components/HomeCalendar';
import type { AppNotification } from '../lib/types';
import { CORE_CAST, INCOMING_INVITE, ME_ID, ORG, RESPONSE_SCRIPT } from '../data/world';
import { fmtTime, weekdayIndex } from '../lib/time';

/**
 * 앱 본체 — 단일 페이지 스텝 머신. reducer가 상태를, 주소창(toUrl/fromUrl)이 딥링크를 소유한다.
 * home·setup·find·confirm·done에 더해 invite(여정 B/미리보기)까지 전 스텝이 실제 화면이다.
 *
 * T19 배선(제품 루프의 마감):
 *  - 초대 뷰 mode: reducer에 origin이 없으므로 직전 스텝을 ref로 추적 — done에서
 *    들어오면 'preview'(내가 보낸 초대의 수신자 관점), 그 외는 'incoming'(민수의 초대).
 *  - 응답 각본: 확정(confirmedSlotId) 후 홈에 도착하는 첫 순간 1회만 재생(세션 로컬
 *    플래그 — reducer가 아니라 로컬 state). 재생이 시작되면 스텝을 옮겨도 끊지 않고
 *    (토스트는 전역 오버레이) cancel은 페이지 언마운트 cleanup에만 묶는다.
 *  - 응답 배지: 도착한 response 알림(personId)을 각본 순서로 모아, 방금 확정한
 *    회의 블록(myEvents의 confirmed-*)에 아바타 스택으로 얹는다.
 */

const ME = ORG.find((p) => p.id === ME_ID)!;
const INVITE_FROM = ORG.find((p) => p.id === INCOMING_INVITE.fromId)!;
/** 성을 뗀 호칭 — '최민수' → '민수'(응답 토스트 '준호님' 톤과 맞춘다). 2글자 이름은 그대로. */
const INVITE_FROM_GIVEN = INVITE_FROM.name.length >= 3 ? INVITE_FROM.name.slice(1) : INVITE_FROM.name;
const CORE_PEOPLE = CORE_CAST.map((id) => ORG.find((p) => p.id === id)!);

const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** INCOMING_INVITE → '목 7월 9일 오후 2:00' */
function inviteDateLabel(): string {
  const [, month, day] = INCOMING_INVITE.day.split('-').map(Number);
  return `${WEEKDAY_SHORT[weekdayIndex(INCOMING_INVITE.day)]} ${month}월 ${day}일 ${fmtTime(INCOMING_INVITE.start)}`;
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { list, toasts, unreadCount, push, dismiss, markAllRead } = useNotifications();

  // 마운트 시 1회 — 주소창의 딥링크 상태를 흡수한다. (아래 동기화 effect보다 먼저
  // 선언되어 있어 초기 상태가 주소창을 덮어쓰기 전에 원본 쿼리를 읽는다.)
  useEffect(() => {
    dispatch({ type: 'HYDRATE', patch: fromUrl(window.location.search) });
  }, []);

  // 상태 변경 → 주소창 반영. 히스토리 스택은 쌓지 않는다(replaceState).
  useEffect(() => {
    history.replaceState(null, '', `?${toUrl(state)}`);
  }, [state]);

  // ── 초대 뷰 mode — 직전 스텝 추적(done → 'preview', 그 외 → 'incoming') ──
  const [inviteMode, setInviteMode] = useState<'incoming' | 'preview'>('incoming');
  const prevStepRef = useRef(state.step);
  useEffect(() => {
    const prev = prevStepRef.current;
    if (state.step === 'invite' && prev !== 'invite') {
      setInviteMode(prev === 'done' ? 'preview' : 'incoming');
    }
    prevStepRef.current = state.step;
  }, [state.step]);

  // ── 응답 각본 재생 — 확정 후 홈 도착 시 1회(세션 로컬 플래그) ──
  const [scriptStarted, setScriptStarted] = useState(false);
  useEffect(() => {
    if (!scriptStarted && state.step === 'home' && state.confirmedSlotId !== null) {
      setScriptStarted(true);
    }
  }, [scriptStarted, state.step, state.confirmedSlotId]);
  useEffect(() => {
    if (!scriptStarted) return;
    // 시작되면 스텝 이동에도 계속 흐른다 — cancel은 언마운트 cleanup에만 묶인다.
    return playResponseScript(push);
  }, [scriptStarted, push]);

  // ── 응답 배지 — 도착한 response 알림을 각본 순서로 모아 확정 회의 블록에 ──
  const responseBadges = useMemo<ResponseBadges | null>(() => {
    const confirmedEvent = [...state.myEvents].reverse().find((e) => e.id.startsWith('confirmed-'));
    if (!confirmedEvent) return null;
    const arrived = new Set(
      [...toasts, ...list].filter((n) => n.kind === 'response' && n.personId).map((n) => n.personId!),
    );
    const people = RESPONSE_SCRIPT.filter((item) => arrived.has(item.personId)).map(
      (item) => ORG.find((p) => p.id === item.personId)!,
    );
    return people.length > 0 ? { eventId: confirmedEvent.id, people } : null;
  }, [state.myEvents, toasts, list]);

  // ── 여정 B 응답 — RESPOND_INVITE + 알림 센터 적립(1회 가드) ──
  const respondInvite = (response: 'accepted' | 'difficult') => {
    if (state.inviteResponded !== null) return; // reducer도 no-op이지만 알림 중복 방지
    dispatch({ type: 'RESPOND_INVITE', response });
    const note: AppNotification = {
      id: `invite-resp-${response}`,
      kind: 'invite',
      personId: INCOMING_INVITE.fromId,
      text:
        response === 'accepted'
          ? `${INVITE_FROM_GIVEN}님에게 참석 응답을 보냈어요`
          : `${INVITE_FROM_GIVEN}님에게 어려운 사정을 전했어요`,
      at: Date.now(),
    };
    push(note);
  };

  return (
    <>
      {state.step === 'home' ? (
        <HomeScreen
          state={state}
          dispatch={dispatch}
          unreadCount={unreadCount}
          notifications={list}
          onOpenNotifications={markAllRead}
          responseBadges={responseBadges}
        />
      ) : state.step === 'setup' ? (
        <SetupForm state={state} dispatch={dispatch} />
      ) : state.step === 'find' ? (
        <FindScreen state={state} dispatch={dispatch} />
      ) : state.step === 'confirm' ? (
        <ConfirmStep state={state} dispatch={dispatch} />
      ) : state.step === 'done' ? (
        <DoneStep state={state} dispatch={dispatch} />
      ) : (
        <InviteView mode={inviteMode} state={state} dispatch={dispatch} onRespond={respondInvite} />
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

// ── 홈 — 분기점: 여정 A(새 일정/할 일 카드) · 여정 B(받은 초대) ──────────

function HomeScreen({
  state,
  dispatch,
  unreadCount,
  notifications,
  onOpenNotifications,
  responseBadges,
}: {
  state: AppState;
  dispatch: Dispatch<Action>;
  unreadCount: number;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  responseBadges: ResponseBadges | null;
}) {
  const startMeeting = () => dispatch({ type: 'PREFILL_CAST' }); // 웰컴·할 일 카드 공용
  const openSetup = () => dispatch({ type: 'SET_STEP', step: 'setup' });
  const openInvite = () => dispatch({ type: 'SET_STEP', step: 'invite' });
  // 응답을 마친 초대는 카드·고스트 모두 소멸한다(수락이면 myEvents의 실제 회의 블록으로 대체).
  const invitePending = state.inviteResponded === null;

  return (
    <div className="min-h-dvh bg-bg pb-32 lg:pb-16">
      {/* 상단 오로라 — 헤더·카드 영역까지만. 본문은 순백으로 가라앉힌다. */}
      <div className="relative overflow-hidden">
        <Aurora variant="home" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
        />
        <div className="relative mx-auto max-w-[1200px] px-4 lg:px-6">
          <Reveal as="header" className="flex h-16 items-center justify-between lg:h-[72px]">
            <Wordmark />
            <NotificationBell unreadCount={unreadCount} list={notifications} onOpen={onOpenNotifications} />
          </Reveal>

          {!state.welcomeDismissed && (
            <Reveal delay={70} className="pt-2">
              <WelcomeCard onStart={startMeeting} onDismiss={() => dispatch({ type: 'DISMISS_WELCOME' })} />
            </Reveal>
          )}

          <div className="grid gap-2.5 pb-7 pt-3.5 lg:grid-cols-2 lg:gap-3">
            <Reveal delay={140}>
              <TaskCard people={CORE_PEOPLE} onPress={startMeeting} />
            </Reveal>
            {invitePending && (
              <Reveal delay={210}>
                <InviteCard from={INVITE_FROM} fromLabel={INVITE_FROM_GIVEN} dateLabel={inviteDateLabel()} onPress={openInvite} />
              </Reveal>
            )}
          </div>
        </div>
      </div>

      <Reveal delay={280} className="mx-auto max-w-[1200px] px-4 lg:px-6">
        {/* 내 기본 일정 + 셋업 혼자 경로로 저장한 개인 일정(myEvents)을 함께 그린다. */}
        <HomeCalendar
          events={[...ME.events, ...state.myEvents]}
          invite={invitePending ? INCOMING_INVITE : null}
          onOpenInvite={openInvite}
          onNewEvent={openSetup}
          responseBadges={responseBadges}
        />
      </Reveal>

      {/* 모바일 고정 CTA — 데스크톱은 캘린더 헤더의 인라인 버튼이 담당한다. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pt-6 lg:hidden"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={openSetup}
          className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white active:bg-primary-pressed"
        >
          새 일정 만들기
        </button>
      </div>
    </div>
  );
}

// ── find — 스캔 모먼트(1회) → 추천 리스트(모바일)/캔버스+레일(데스크톱) ────

/**
 * '시간 찾아보기' 착지 화면. `!scanPlayed`면 스캔 모먼트를 먼저 재생하고(뒤 콘텐츠는
 * 렌더하지 않는다 — 빈 배경 위 카드 하나), onDone에서 PLAY_SCAN → 추천 화면 리빌.
 * scanPlayed=true면 즉시 콘텐츠 — 조건 변경·재진입 어느 경로로도 스캔은 재등장하지 않는다.
 * reduced-motion: 연출 전체 생략 — 즉시 PLAY_SCAN + aria-live polite 1회 공지.
 * 후보 파생(useCandidates)은 여기서 한 번만 — 모바일(lg 미만)·데스크톱(lg 이상)이 공유하고,
 * 스캔 문장(scanLine)도 같은 attendees·insights 실출력을 쓴다(하드코딩 금지 계약).
 */
function FindScreen({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const reduced = !!useReducedMotion();
  const candidates = useCandidates(state);
  const isDesktop = useIsDesktop();
  const [announced, setAnnounced] = useState(false);

  useEffect(() => {
    if (!state.scanPlayed && reduced) {
      dispatch({ type: 'PLAY_SCAN' });
      setAnnounced(true);
    }
  }, [state.scanPlayed, reduced, dispatch]);

  const scanning = !state.scanPlayed && !reduced;

  return (
    <main className="min-h-dvh bg-bg">
      {scanning ? (
        <div className="mx-auto w-full max-w-[560px] px-4 pt-6 lg:pt-12">
          <ScanMoment
            attendees={candidates.attendees}
            insights={candidates.insights}
            duration={state.duration}
            onDone={() => dispatch({ type: 'PLAY_SCAN' })}
          />
        </div>
      ) : isDesktop ? (
        <FindTimeDesktop state={state} dispatch={dispatch} candidates={candidates} />
      ) : (
        <FindTimeMobile state={state} dispatch={dispatch} candidates={candidates} />
      )}
      {/* reduced-motion 공지 — live 영역은 상시 존재해야 삽입 텍스트가 공지된다 */}
      <div aria-live="polite" className="sr-only">
        {announced ? `${candidates.attendees.length}명의 일정을 확인했어요` : ''}
      </div>
    </main>
  );
}

