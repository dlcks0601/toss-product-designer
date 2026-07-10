'use client';

import { useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import AttendeePicker from './AttendeePicker';
import Aurora from './Aurora';
import Avatar from './Avatar';
import Chip from './Chip';
import FrostedBar from './FrostedBar';
import { KIND_STYLE } from './HomeCalendar';
import DateField from './DateField';
import PickerField from './PickerField';
import Wordmark from './Wordmark';
import Reveal from './Reveal';
import { isMeeting } from '../app-state/reducer';
import type { Action, AppState } from '../app-state/reducer';
import { ME_ID, ORG } from '../data/world';
import { businessDaysFrom, fmtDayKorean, fmtTime, type Minutes } from '../lib/time';
import { ANCHOR_DATE, windowFor } from '../lib/window';
import type { DeadlineKind, Person } from '../lib/types';

/**
 * 셋업 — 하나의 폼, 모핑. "일정은 혼자면 결정, 사람이 생기면 협상이 된다"를 폼의 변형으로 말한다.
 *
 * 혼자(참석자=나 1인): 제목·날짜·시작~종료 → `일정 만들기`(ADD_MY_EVENT, 개인 일정 저장 후 홈 복귀).
 * 참석자가 생기는 순간(450ms 한 호흡): 날짜·시간 필드가 접히고(height+opacity) 회의 길이 칩과
 * "언제까지 잡아야 하나요?" 기한 칩이 60ms 스태거로 등장, CTA는 `시간 찾아보기`로 크로스페이드.
 * 혼자로 돌아오면 같은 곡선의 역방향. 나가는 블록과 들어오는 블록이 같은 450ms expo 곡선을 타므로
 * 합산 높이가 단조 보간된다 — 아래 요소(CTA)가 출렁이지 않는다. reduced-motion 시 즉시 전환.
 *
 * 참석자 행: 꼭/선택 핀(SET_REQUIRED, 주최자는 핀 없음 — 고정 필수), 아바타 탭 → 프로필 피크
 * (모바일 인라인/데스크톱 행 옆 팝오버). ORG.find는 널가드 — HYDRATE가 unknown id를 허용한다.
 *
 * PC(lg+)는 반반 스플릿 — 타이틀이 무대 전체를 열고, 왼쪽 "무엇을·언제" / 오른쪽 "누구와 + CTA".
 * 사람을 더하는 쪽(오른쪽)이 원인, 폼이 변하는 쪽(왼쪽)이 결과라는 구조가 공간으로 드러난다.
 * CTA는 참석자 아래 인라인("이 사람들과 → 시간 찾아보기") — 고정 오버레이가 없어 폼이 화면에
 * 들어가면 스크롤도 없다. 모바일은 기존 한 칼럼 + 하단 고정 CTA 그대로.
 */

// ── 상수 — 순수·결정적(데모 앵커 기준) ─────────────────────────────

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

/** 개인 일정 날짜 후보 — 앵커 다음 영업일부터 데이터가 있는 7/24까지 13일. */
const DAY_OPTIONS = businessDaysFrom(ANCHOR_DATE, 13);

/** 혼자 일정의 종류 — 회사 캘린더엔 회사 일정만 적는다(개인 약속은 휴가라는 회사의 언어로 나타난다).
 *  집중 시간 = 개인 업무를 반드시 봐야 하는 시간, 외근 = 출장, 휴가 = 시간 단위로도 쓴다(personal kind
 *  재해석 — 하드 블록이라 휴가인 사람에겐 회의가 잡히지 않는다). meeting은 시간 찾기 경로 전용.
 *  칩 색은 홈 캘린더 카드 색(KIND_STYLE)과 단일 소스 — 고른 색 그대로 캘린더에 앉는다. */
export type MyEventKind = 'personal' | 'focus' | 'offsite' | 'lunch';
const MY_KIND_OPTIONS: { value: MyEventKind; label: string; tint: { bg: string; text: string } }[] = [
  { value: 'focus', label: '집중 시간', tint: { bg: KIND_STYLE.focus.bg, text: KIND_STYLE.focus.title } },
  { value: 'offsite', label: '외근', tint: { bg: KIND_STYLE.offsite.bg, text: KIND_STYLE.offsite.title } },
  { value: 'lunch', label: '점심', tint: { bg: KIND_STYLE.lunch.bg, text: KIND_STYLE.lunch.title } },
  { value: 'personal', label: '휴가', tint: { bg: KIND_STYLE.personal.bg, text: KIND_STYLE.personal.title } },
];
/** 종류별 제목 힌트 — 회사 캘린더의 언어로. */
const KIND_PLACEHOLDER: Record<MyEventKind, string> = {
  focus: '기획서 집중',
  offsite: '고객사 방문',
  lunch: '점심',
  personal: '오후 휴가',
};
/** 30분 스텝 시각(9:00~19:00) — 홈 캘린더 프레임과 같은 범위. */
const TIME_OPTIONS: Minutes[] = Array.from({ length: 21 }, (_, i) => 540 + i * 30);

/** 모핑 한 호흡 — 450ms expo-out(디자인 토큰 --bezier-expo와 동일 곡선). */
const MORPH = { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const };
/** 위치 이동 스프링 — 오버슈트 없는 {350, 30}(토스트와 동일 규칙). */
const POSITION_SPRING = { type: 'spring' as const, stiffness: 350, damping: 30 };

// ── 작은 조각들 ────────────────────────────────────────────────────

/** 필드 라벨 + 내용 — 모핑 블록 안에서 스태거 등장(delay)할 수 있는 단위. */
function FieldGroup({
  label,
  delay,
  animate,
  children,
}: {
  label: string;
  delay: number;
  /** true면 블록 등장 시 opacity+y 스태거로 나타난다(모핑 중에만). */
  animate: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: MORPH.ease }}
    >
      <p className="text-[14px] font-semibold text-text-strong">{label}</p>
      <div className="mt-2.5">{children}</div>
    </motion.div>
  );
}

// ── 모핑 양면 — 혼자(날짜·시간) / 함께(길이·기한) ───────────────────

function SoloFields({
  day,
  start,
  end,
  kind,
  dottedDays,
  onDay,
  onStart,
  onEnd,
  onKind,
  stagger,
}: {
  day: string;
  start: Minutes;
  end: Minutes;
  kind: MyEventKind;
  /** 내 일정이 있는 날 — 달력 그리드의 점 힌트. */
  dottedDays: Set<string>;
  onDay: (d: string) => void;
  onStart: (m: Minutes) => void;
  onEnd: (m: Minutes) => void;
  onKind: (k: MyEventKind) => void;
  stagger: boolean;
}) {
  return (
    <div className="space-y-6 pt-7">
      <FieldGroup label="어떤 시간인가요?" delay={0.09} animate={stagger}>
        <div className="flex flex-wrap gap-2">
          {MY_KIND_OPTIONS.map((o) => (
            <Chip key={o.value} selected={kind === o.value} tint={o.tint} onClick={() => onKind(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="날짜" delay={0.12} animate={stagger}>
        {/* 리스트가 아니라 달력 그리드에서 — 홈 월간 피커와 같은 문법. */}
        <DateField value={day} onChange={onDay} selectable={DAY_OPTIONS} dotted={dottedDays} ariaLabel="날짜" />
      </FieldGroup>
      <FieldGroup label="시간" delay={0.18} animate={stagger}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
          <PickerField
            value={String(start)}
            onChange={(v) => {
              const s = Number(v);
              onStart(s);
              if (end <= s) onEnd(Math.min(s + 60, 1140));
            }}
            ariaLabel="시작 시간"
            options={TIME_OPTIONS.slice(0, -1).map((m) => ({ value: String(m), label: fmtTime(m) }))}
          />
          <span className="text-[14px] text-text-weak" aria-hidden>
            –
          </span>
          <PickerField
            value={String(end)}
            onChange={(v) => onEnd(Number(v))}
            ariaLabel="종료 시간"
            options={TIME_OPTIONS.filter((m) => m > start).map((m) => ({ value: String(m), label: fmtTime(m) }))}
          />
        </div>
      </FieldGroup>
    </div>
  );
}

function MeetingFields({
  duration,
  deadline,
  dispatch,
  stagger,
}: {
  duration: 30 | 60 | 90;
  deadline: DeadlineKind;
  dispatch: Dispatch<Action>;
  stagger: boolean;
}) {
  return (
    <div className="space-y-6 pt-7">
      <FieldGroup label="회의 길이" delay={0.12} animate={stagger}>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={duration === o.value}
              onClick={() => dispatch({ type: 'SET_DURATION', duration: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="언제까지 잡아야 하나요?" delay={0.18} animate={stagger}>
        <div className="flex flex-wrap gap-2">
          {DEADLINE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={deadline === o.value}
              onClick={() => dispatch({ type: 'SET_DEADLINE', deadline: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

// ── 참석자 행 ──────────────────────────────────────────────────────

function AttendeeRow({
  person,
  isMe,
  required,
  onPin,
  onRemove,
}: {
  person: Person;
  isMe: boolean;
  required: boolean;
  onPin: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 py-2">
        <Avatar person={person} size={32} />
        <span className="min-w-0 flex-1 truncate py-1 text-[15px] font-medium text-text-strong">
          {person.name}
          {isMe && <span className="ml-1.5 text-[12px] font-normal text-text-weak">나 · 주최자</span>}
        </span>
        {!isMe && (
          /* 꼭참석/선택 토글 필 — 단일 필 유지(미감 우선 결정). 탭하면 상태가 뒤집힌다. */
          <button
            type="button"
            aria-pressed={required}
            aria-label={`${person.name} ${required ? '꼭 참석' : '선택 참석'}`}
            onClick={onPin}
            className={`pressable h-7 shrink-0 rounded-full px-2.5 text-[12px] font-semibold transition-colors ${
              required
                ? 'bg-primary-tint text-primary hover:bg-[#D6E9FF]'
                : 'bg-section text-text-weak hover:bg-[#E5E8EB] hover:text-text-strong'
            }`}
          >
            {required ? '꼭 참석' : '선택'}
          </button>
        )}
        {!isMe && (
          <button
            type="button"
            aria-label={`${person.name} 빼기`}
            onClick={onRemove}
            className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-section hover:text-text-weak"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

// ── 본체 ───────────────────────────────────────────────────────────

export interface SetupFormProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** 혼자 일정 저장 직후 — 홈 복귀가 무음이 되지 않게 토스트 피드백을 배선한다(page.tsx). */
  onSaved?: () => void;
}

export default function SetupForm({ state, dispatch, onSaved }: SetupFormProps) {
  const meeting = isMeeting(state);
  const reduced = !!useReducedMotion();
  // 피커가 열려 있는 동안은 열던 순간의 폼 모습을 유지한다 — 참석자 토글은 라이브지만,
  // 모핑(컨셉 모먼트)은 딤 뒤에서 몰래 일어나지 않고 피커가 닫히는 순간 한 호흡으로 보인다.
  const [picker, setPicker] = useState<{ open: boolean; wasMeeting: boolean }>({ open: false, wasMeeting: false });
  const pickerOpen = picker.open;
  const shownMeeting = pickerOpen ? picker.wasMeeting : meeting;
  // 개인 일정 필드 — 조율 조건이 아니므로 reducer가 아닌 로컬 상태(저장 순간에만 이벤트로 응고).
  const [day, setDay] = useState(DAY_OPTIONS[0]);
  const [start, setStart] = useState<Minutes>(600);
  const [end, setEnd] = useState<Minutes>(660);
  const [kind, setKind] = useState<MyEventKind>('focus');

  const windowDays = useMemo(() => windowFor(state.deadline), [state.deadline]);
  // ORG.find 널가드 — HYDRATE 딥링크가 unknown id를 실어올 수 있다(조용히 건너뛴다).
  const attendees = useMemo(
    () =>
      state.attendeeIds
        .map((id) => ORG.find((p) => p.id === id))
        .filter((p): p is Person => p !== undefined),
    [state.attendeeIds],
  );

  const canSave = state.title.trim().length > 0 && end > start;

  const goHome = () => dispatch({ type: 'SET_STEP', step: 'home' });
  const submit = () => {
    if (meeting) {
      dispatch({ type: 'SET_STEP', step: 'find' });
      return;
    }
    if (!canSave) return;
    dispatch({
      type: 'ADD_MY_EVENT',
      event: {
        id: `my-${day}-${start}-${state.myEvents.length}`,
        day,
        start,
        end,
        title: state.title.trim(),
        kind,
      },
    });
    onSaved?.();
  };
  const toggleAttendee = (id: string) => dispatch({ type: 'TOGGLE_ATTENDEE', id });

  // 내 일정이 있는 날 — 달력 그리드의 점 힌트(홈 월간 피커와 같은 파생).
  const dottedDays = useMemo(() => {
    const me = ORG.find((p) => p.id === ME_ID)!;
    return new Set([...me.events, ...state.myEvents].map((e) => e.day));
  }, [state.myEvents]);

  const soloFields = (
    <SoloFields
      day={day}
      start={start}
      end={end}
      kind={kind}
      dottedDays={dottedDays}
      onDay={setDay}
      onStart={setStart}
      onEnd={setEnd}
      onKind={setKind}
      stagger={!reduced}
    />
  );
  const meetingFields = (
    <MeetingFields duration={state.duration} deadline={state.deadline} dispatch={dispatch} stagger={!reduced} />
  );

  // CTA — 라벨 크로스페이드: 일정 만들기 ↔ 시간 찾아보기 (모바일 고정/데스크톱 인플로우 공용)
  const cta = (
    <button
      type="button"
      onClick={submit}
      disabled={!meeting && !canSave}
      className="pressable h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white transition-colors active:bg-primary-pressed disabled:bg-section disabled:text-text-faint"
    >
      <span className="grid">
        <span
          aria-hidden={shownMeeting}
          className={`col-start-1 row-start-1 transition-opacity duration-200 ${shownMeeting ? 'opacity-0' : 'opacity-100'}`}
        >
          일정 만들기
        </span>
        <span
          aria-hidden={!shownMeeting}
          className={`col-start-1 row-start-1 transition-opacity duration-200 ${shownMeeting ? 'opacity-100' : 'opacity-0'}`}
        >
          시간 찾아보기
        </span>
      </span>
    </button>
  );

  // pb: 모바일은 고정 CTA(≈94px) 위 여유, PC는 고정층이 없어 숨 쉴 틈 48px이면 충분.
  return (
    <div className="min-h-dvh bg-bg pb-32 lg:pb-12">
      {/* 데스크톱 헤더 — 홈과 같은 오로라·워드마크. 스텝이 바뀌어도 페이지 틀은 유지된다. */}
      <div className="relative hidden lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Aurora variant="home" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </div>
        <div className="relative mx-auto max-w-[1200px] px-6 py-4">
          {/* h-10 — 홈 헤더 줄(우측 버튼 36px 때문에 40px)과 로고 세로 위치를 맞춘다. */}
          <header className="flex h-10 items-center">
            <Wordmark />
          </header>
        </div>
      </div>

      {/* 뒤로가기 줄 — 스크롤하면 frosted로 얼어붙는다(홈 헤더와 같은 문법). */}
      <FrostedBar innerClassName="mx-auto max-w-[520px] px-4 lg:max-w-[1200px] lg:px-6">
        <Reveal as="header" className="-mx-1 flex h-14 items-center lg:mx-0">
          <button
            type="button"
            onClick={goHome}
            aria-label="뒤로"
            className="pressable -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-text-strong hover:bg-section"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        </Reveal>
      </FrostedBar>

      <div className="mx-auto max-w-[520px] px-4 lg:max-w-[1200px] lg:px-6 lg:pt-2">
        {/* 데스크톱: 카드 없이 흰 페이지 위 중앙 무대 — 타이틀 풀스팬 + 아래 반반 스플릿. */}
        <div>
        <div className="lg:mx-auto lg:max-w-[920px] lg:px-4">

        <Reveal delay={70} className="pt-3 lg:pt-0">
          <h1 className="text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong">
            어떤 일정을 만들까요?
          </h1>
          <p className="mt-1.5 break-keep text-[13px] leading-[1.5] text-text-weak">
            혼자면 바로 캘린더에, 함께면 좋은 시간을 찾아드려요
          </p>
        </Reveal>

        {/* lg: 좌 "무엇을·언제" / 우 "누구와 + CTA" — DOM 순서(입력→참석자→필드)는 모바일 그대로,
            grid 배치만으로 갈라진다. 오른쪽은 두 행에 걸쳐 자기 흐름대로 자란다. */}
        <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-14">

        {/* 제목 — 밑줄 입력(혼자·함께 공통) */}
        <Reveal delay={140} className="pt-6 lg:col-start-1 lg:row-start-1">
          <input
            value={state.title}
            onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
            placeholder={shownMeeting ? '주간 싱크' : KIND_PLACEHOLDER[kind]}
            aria-label="일정 제목"
            className="w-full border-b-2 border-border bg-transparent py-2.5 text-[19px] font-semibold text-text-strong outline-none transition-colors placeholder:text-text-faint focus:border-primary"
          />
        </Reveal>

        {/* 참석자 — lg에선 오른쪽 기둥(두 행 스팬), CTA까지 품는다 */}
        <Reveal delay={210} className="pt-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6">
          <p className="text-[14px] font-semibold text-text-strong">
            참석자 <span className="text-primary">{attendees.length}명</span>
          </p>
          <div className="mt-1.5">
            {reduced ? (
              attendees.map((p) => (
                <AttendeeRow
                  key={p.id}
                  person={p}
                  isMe={p.id === ME_ID}
                  required={!!state.required[p.id]}
                  onPin={() => dispatch({ type: 'SET_REQUIRED', id: p.id, required: !state.required[p.id] })}
                  onRemove={() => toggleAttendee(p.id)}
                />
              ))
            ) : (
              <AnimatePresence initial={false}>
                {attendees.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={POSITION_SPRING}
                    className="overflow-hidden"
                  >
                    <AttendeeRow
                      person={p}
                      isMe={p.id === ME_ID}
                      required={!!state.required[p.id]}
                      onPin={() => dispatch({ type: 'SET_REQUIRED', id: p.id, required: !state.required[p.id] })}
                      onRemove={() => toggleAttendee(p.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {/* + 참석자 추가 → 피커 */}
            <button
              type="button"
              onClick={() => setPicker({ open: true, wasMeeting: meeting })}
              className="pressable -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-section/60"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-text-faint text-text-weak"
              >
                <Plus size={15} strokeWidth={2.4} />
              </span>
              <span className="text-[15px] font-medium text-primary">참석자 추가</span>
            </button>

            {/* PC: CTA가 참석자 바로 아래 — "이 사람들과 → 시간 찾아보기" 서사.
                혼자일 땐 힌트 한 줄이 오른쪽 여백을 초대장으로 만든다. */}
            <div className="hidden lg:block">
              <AnimatePresence initial={false}>
                {!shownMeeting && (
                  <motion.div
                    key="invite-hint"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={reduced ? { duration: 0 } : MORPH}
                    className="overflow-hidden"
                  >
                    <p className="px-1 pt-1.5 text-[13px] leading-[1.5] text-text-faint">
                      함께할 사람을 더하면, 좋은 시간을 대신 찾아드려요
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="pt-7">{cta}</div>
            </div>
          </div>
        </Reveal>

        {/* 모핑 영역 — 혼자(날짜·시간) ↔ 함께(길이·기한). lg에선 왼쪽 아래 행. */}
        <Reveal delay={280} className="lg:col-start-1 lg:row-start-2">
          {reduced ? (
            <div>{shownMeeting ? meetingFields : soloFields}</div>
          ) : (
            <AnimatePresence initial={false}>
              {/* overflow는 모핑 중에만 hidden — 끝나면 visible로 풀어야 피커 팝오버가 잘리지 않는다. */}
              {shownMeeting ? (
                <motion.div
                  key="meeting"
                  initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                  animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                  exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                  transition={MORPH}
                >
                  {meetingFields}
                </motion.div>
              ) : (
                <motion.div
                  key="solo"
                  initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                  animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                  exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                  transition={MORPH}
                >
                  {soloFields}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Reveal>

        </div>

        </div>
        </div>
      </div>

      {/* CTA — 모바일만 하단 고정(토스 BottomCTA). PC는 참석자 기둥 아래 인라인이라 없다. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-4 pt-6 lg:hidden"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {/* 하단 frost — 접히는 폼이 반투명 너머로 흐릿하게 지나간다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent"
        />
        <div className="relative mx-auto max-w-[520px]">{cta}</div>
      </div>

      {/* 참석자 피커 — 모바일 바텀시트 / 데스크톱 중앙 모달 */}
      <AnimatePresence>
        {pickerOpen && (
          <AttendeePicker
            attendeeIds={state.attendeeIds}
            windowDays={windowDays}
            onToggle={toggleAttendee}
            onClose={() => setPicker((p) => ({ ...p, open: false }))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
