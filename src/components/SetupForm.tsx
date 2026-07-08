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

/** 혼자 일정의 종류 — meeting은 시간 찾기 경로 전용이라 여기 없다. 이 앱이 캘린더 원본이므로
 *  집중·외근·점심도 여기서 선언된다(동료들의 캘린더도 같은 경로로 만들어졌다는 세계관).
 *  칩 색은 홈 캘린더 카드 색(KIND_STYLE)과 단일 소스 — 고른 색 그대로 캘린더에 앉는다.
 *  점심만 예외: 카드 bg(#F2F4F6)가 비선택 칩과 같아 구분이 안 돼 한 단계 진하게. */
export type MyEventKind = 'personal' | 'focus' | 'offsite' | 'lunch';
const MY_KIND_OPTIONS: { value: MyEventKind; label: string; tint: { bg: string; text: string } }[] = [
  { value: 'personal', label: '개인 약속', tint: { bg: KIND_STYLE.personal.bg, text: KIND_STYLE.personal.title } },
  { value: 'focus', label: '집중 시간', tint: { bg: KIND_STYLE.focus.bg, text: KIND_STYLE.focus.title } },
  { value: 'offsite', label: '외근', tint: { bg: KIND_STYLE.offsite.bg, text: KIND_STYLE.offsite.title } },
  { value: 'lunch', label: '점심', tint: { bg: '#E5E8EB', text: '#4E5968' } },
];
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
        <PickerField
          value={day}
          onChange={onDay}
          ariaLabel="날짜"
          options={DAY_OPTIONS.map((d) => ({ value: d, label: fmtDayKorean(d) }))}
        />
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
}

export default function SetupForm({ state, dispatch }: SetupFormProps) {
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
  const [kind, setKind] = useState<MyEventKind>('personal');

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
  };
  const toggleAttendee = (id: string) => dispatch({ type: 'TOGGLE_ATTENDEE', id });

  const soloFields = (
    <SoloFields
      day={day}
      start={start}
      end={end}
      kind={kind}
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

  return (
    <div className="min-h-dvh bg-bg pb-32 lg:pb-16">
      {/* 데스크톱 헤더 — 홈과 같은 오로라·워드마크. 스텝이 바뀌어도 페이지 틀은 유지된다. */}
      <div className="relative hidden lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Aurora variant="home" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </div>
        <div className="relative mx-auto max-w-[1200px] px-6 py-4">
          <header className="flex items-center">
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
            className="pressable -ml-1 flex h-10 items-center gap-1 rounded-full pl-1.5 pr-3 text-[15px] font-semibold text-text-strong hover:bg-section"
          >
            <ChevronLeft size={20} aria-hidden />
            일정 만들기
          </button>
        </Reveal>
      </FrostedBar>

      <div className="mx-auto max-w-[520px] px-4 lg:max-w-[1200px] lg:px-6 lg:pt-2">
        {/* 데스크톱: 테두리·카드 없이 흰 페이지 위 640px 중앙 컬럼(토스 풀페이지 폼 문법). */}
        <div>
        <div className="lg:mx-auto lg:max-w-[640px] lg:px-4">

        <Reveal delay={70} className="pt-3">
          <h1 className="text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-text-strong">
            어떤 일정을 만들까요?
          </h1>
          <p className="mt-1.5 break-keep text-[13px] leading-[1.5] text-text-weak">
            혼자면 바로 캘린더에, 함께면 좋은 시간을 찾아드려요
          </p>
        </Reveal>

        {/* 제목 — 밑줄 입력(혼자·함께 공통) */}
        <Reveal delay={140} className="pt-6">
          <input
            value={state.title}
            onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
            placeholder="치과 예약"
            aria-label="일정 제목"
            className="w-full border-b-2 border-border bg-transparent py-2.5 text-[19px] font-semibold text-text-strong outline-none transition-colors placeholder:text-text-faint focus:border-primary"
          />
        </Reveal>

        {/* 참석자 */}
        <Reveal delay={210} className="pt-7">
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
          </div>
        </Reveal>

        {/* 모핑 영역 — 혼자(날짜·시간) ↔ 함께(길이·기한) */}
        <Reveal delay={280}>
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

        {/* CTA(데스크톱) — 폼 흐름 안에 살아 모핑의 높이 변화를 같이 탄다 */}
        <Reveal delay={350} className="hidden pt-9 lg:block">
          {cta}
        </Reveal>
        </div>
        </div>
      </div>

      {/* CTA(모바일) — 홈과 같은 하단 고정 패턴. 접히는 폼 위에 항상 떠 있어 크로스페이드가 보인다. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pt-6 lg:hidden"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-[520px]">{cta}</div>
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
