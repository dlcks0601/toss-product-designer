'use client';

import { useEffect, useReducer, type Dispatch } from 'react';
import Aurora from '../components/Aurora';
import HomeCalendar from '../components/HomeCalendar';
import InviteCard from '../components/InviteCard';
import NotificationBell from '../components/NotificationBell';
import Reveal from '../components/Reveal';
import SetupForm from '../components/SetupForm';
import TaskCard from '../components/TaskCard';
import ToastStack from '../components/ToastStack';
import WelcomeCard from '../components/WelcomeCard';
import Wordmark from '../components/Wordmark';
import { useNotifications } from '../app-state/notifications';
import { fromUrl, initialState, reducer, toUrl } from '../app-state/reducer';
import type { Action, AppState, Step } from '../app-state/reducer';
import { CORE_CAST, INCOMING_INVITE, ME_ID, ORG } from '../data/world';
import { fmtTime, weekdayIndex } from '../lib/time';

/**
 * 앱 본체 — 단일 페이지 스텝 머신. reducer가 상태를, 주소창(toUrl/fromUrl)이 딥링크를 소유한다.
 * 'home'만 실제 화면이고 나머지 스텝은 다음 태스크(T13~T19)가 채울 자리 표시자다.
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
  const { toasts, unreadCount, dismiss } = useNotifications();

  // 마운트 시 1회 — 주소창의 딥링크 상태를 흡수한다. (아래 동기화 effect보다 먼저
  // 선언되어 있어 초기 상태가 주소창을 덮어쓰기 전에 원본 쿼리를 읽는다.)
  useEffect(() => {
    dispatch({ type: 'HYDRATE', patch: fromUrl(window.location.search) });
  }, []);

  // 상태 변경 → 주소창 반영. 히스토리 스택은 쌓지 않는다(replaceState).
  useEffect(() => {
    history.replaceState(null, '', `?${toUrl(state)}`);
  }, [state]);

  return (
    <>
      {state.step === 'home' ? (
        <HomeScreen state={state} dispatch={dispatch} unreadCount={unreadCount} />
      ) : state.step === 'setup' ? (
        <SetupForm state={state} dispatch={dispatch} />
      ) : (
        <PlaceholderScreen step={state.step} dispatch={dispatch} />
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
}: {
  state: AppState;
  dispatch: Dispatch<Action>;
  unreadCount: number;
}) {
  const startMeeting = () => dispatch({ type: 'PREFILL_CAST' }); // 웰컴·할 일 카드 공용
  const openSetup = () => dispatch({ type: 'SET_STEP', step: 'setup' });
  const openInvite = () => dispatch({ type: 'SET_STEP', step: 'invite' });

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
            <NotificationBell unreadCount={unreadCount} />
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
            <Reveal delay={210}>
              <InviteCard from={INVITE_FROM} fromLabel={INVITE_FROM_GIVEN} dateLabel={inviteDateLabel()} onPress={openInvite} />
            </Reveal>
          </div>
        </div>
      </div>

      <Reveal delay={280} className="mx-auto max-w-[1200px] px-4 lg:px-6">
        {/* 내 기본 일정 + 셋업 혼자 경로로 저장한 개인 일정(myEvents)을 함께 그린다. */}
        <HomeCalendar
          events={[...ME.events, ...state.myEvents]}
          invite={INCOMING_INVITE}
          onOpenInvite={openInvite}
          onNewEvent={openSetup}
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

// ── 자리 표시자 — home 외 스텝은 다음 태스크에서 채운다 ─────────────────

function PlaceholderScreen({ step, dispatch }: { step: Step; dispatch: Dispatch<Action> }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-5 px-4">
      <Reveal className="w-full rounded-card bg-section px-6 py-12 text-center text-[15px] font-medium text-text-body">
        단계: {step} — 다음 태스크에서 채워요
      </Reveal>
      <Reveal delay={70}>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_STEP', step: 'home' })}
          className="pressable inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-semibold text-text-body ring-1 ring-border"
        >
          돌아가기
        </button>
      </Reveal>
    </main>
  );
}
