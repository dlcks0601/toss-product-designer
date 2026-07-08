'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Person } from '../lib/types';
import { deriveInsights } from '../lib/insights';
import { fmtRange, weekdayIndex } from '../lib/time';
import { eventsOn } from './HomeCalendar';

/**
 * 프로필 피크('다' 안) — 헤더 없음. 참석자 행 아래 인라인(모바일)/행 옆 팝오버(데스크톱).
 *
 * 형식: 주간 스트립 + 탭한 날만 상세(progressive disclosure).
 *  - 스트립: 요일·날짜 밑에 일정 개수만큼 점(최대 3) — 바쁨의 밀도. 개수 따라 회색→연분홍→분홍.
 *  - 탭하면 그 날의 일정만 제목/시간·미팅룸으로 펼친다(기본 = 첫날). 점심은 줄에서 빼고
 *    맨 아래 리듬 각주가 대신 말한다. 5일 전체 나열은 산만해서 버렸다.
 *
 * 내용은 전부 파생이다(하드코딩 금지 계약):
 *  - 날들 = 기한 창(windowFor(deadline))의 앞 5영업일 × person.events 실제 블록.
 *  - 맨 아래 각주 한 줄 = deriveInsights(person, windowDays).headline — null이면 생략.
 *  기한 칩이 바뀌면 windowDays가 바뀌고 피크 범위·각주가 함께 따라온다.
 *
 * 열림/닫힘: 부모의 AnimatePresence 안에서 height+opacity 200ms(인라인)/스케일 페이드(팝오버).
 * reduced-motion 시 즉시 전환.
 */

/** 미니 캘린더가 보여주는 날 수 — 기한 창의 "첫 주" = 앞 5영업일. */
export const PEEK_DAY_COUNT = 5;

/** 기한 창 → 피크가 그리는 날들. this-week처럼 창이 짧으면 있는 만큼만(3열). */
export function peekDays(windowDays: string[]): string[] {
  return windowDays.slice(0, PEEK_DAY_COUNT);
}

const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface ProfilePeekProps {
  person: Person;
  /** windowFor(deadline) — 각주는 창 전체, 미니 캘린더는 앞 5영업일. */
  windowDays: string[];
  /** auto = 모바일 인라인 + 데스크톱 팝오버(행 옆) / inline = 항상 인라인(피커 안). */
  mode?: 'auto' | 'inline';
}

/** 하루의 피크 항목 — 점심 제외(리듬 각주가 대신 말한다). */
function dayItems(person: Person, day: string) {
  return eventsOn(person.events, day).filter((ev) => ev.kind !== 'lunch');
}

/** 피크 본문 — 주간 스트립(점 밀도) + 탭한 날 상세 + 각주. 컨테이너(인라인/팝오버)가 감싼다. */
function PeekBody({ person, windowDays }: { person: Person; windowDays: string[] }) {
  const days = peekDays(windowDays);
  const [picked, setPicked] = useState<string | null>(null);
  // 기한 칩이 바뀌어 창이 달라지면 선택을 첫날로 되돌린다.
  const selDay = picked && days.includes(picked) ? picked : days[0];
  const headline = useMemo(() => deriveInsights(person, windowDays).headline, [person, windowDays]);
  const selected = dayItems(person, selDay);

  return (
    <div role="region" aria-label={`${person.name}님의 일정 미리보기`}>
      {/* 주간 스트립 — 날짜 밑 점 = 일정 개수(최대 3). 개수 따라 회색→연분홍→분홍. */}
      <div className="flex gap-1">
        {days.map((day) => {
          const items = dayItems(person, day);
          const isSel = day === selDay;
          // 색 = 바쁨의 밀도(범례 없이 읽힌다): 개수 따라 회색 → 연분홍 → 분홍으로 데워진다.
          // 외근 여부는 색으로 숨기지 않는다 — 탭한 날 상세와 각주 문장이 글로 말한다.
          const dotColor = items.length >= 3 ? '#EE8296' : items.length === 2 ? '#F4B8C1' : '#B0B8C1';
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSel}
              aria-label={`${WEEKDAY_SHORT[weekdayIndex(day)]} ${Number(day.slice(8, 10))}일 일정 ${items.length}개`}
              onClick={() => setPicked(day)}
              className="flex flex-1 flex-col items-center gap-1 py-1.5"
            >
              {/* 선택 = 홈 캘린더 데이 칩 문법 — 요일 파랑 + 숫자 파란 원 */}
              <span className={`text-[10px] leading-none ${isSel ? 'font-semibold text-primary' : 'text-text-weak'}`}>
                {WEEKDAY_SHORT[weekdayIndex(day)]}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold leading-none transition-colors ${
                  isSel ? 'bg-primary text-white' : 'text-text-body'
                }`}
              >
                {Number(day.slice(8, 10))}
              </span>
              {/* 점 = 일정 개수(최대 3) — 바쁨의 밀도가 한눈에 보인다. */}
              <span aria-hidden className="flex h-1 items-center gap-[3px]">
                {Array.from({ length: Math.min(items.length, 3) }).map((_, i) => (
                  <span key={i} className="h-1 w-1 rounded-full" style={{ backgroundColor: dotColor }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* 탭한 날 상세 — 한 줄에 제목(좌)·시간·미팅룸(우). 세로 간격을 줄이고 우측 여백을 쓴다. */}
      <div className="mt-1.5">
        {selected.length === 0 ? (
          <p className="py-1 text-[12px] leading-[1.4] text-text-faint">일정 없음 — 하루가 비어 있어요</p>
        ) : (
          <ul className="space-y-[3px]">
            {selected.map((ev) => (
              <li key={ev.id} className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="truncate text-[13px] font-medium leading-[1.5] text-text-strong">{ev.title}</p>
                <p className="shrink-0 text-[12px] leading-[1.5] text-text-weak">
                  {fmtRange(ev.start, ev.end)}
                  {ev.room ? ` · ${ev.room}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {headline && (
        <p className="mt-2.5 border-t border-border/60 pt-2 text-[12px] leading-[1.45] text-text-body">{headline}</p>
      )}
    </div>
  );
}

export default function ProfilePeek({ person, windowDays, mode = 'auto' }: ProfilePeekProps) {
  const reduced = !!useReducedMotion();
  const dur = reduced ? 0 : 0.2;

  // 인라인 — 행 아래에서 height+opacity 200ms로 펼쳐진다.
  const inline = (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: dur, ease: 'easeOut' }}
      className={`overflow-hidden ${mode === 'auto' ? 'lg:hidden' : ''}`}
    >
      <div className="mb-2 mt-1 rounded-2xl bg-section p-3.5">
        <PeekBody person={person} windowDays={windowDays} />
      </div>
    </motion.div>
  );

  if (mode === 'inline') return inline;

  return (
    <>
      {inline}
      {/* 팝오버 — 데스크톱, 행 옆(왼쪽 상단 기준 스케일 페이드) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, x: -4 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.97, x: -4 }}
        transition={{ duration: dur, ease: 'easeOut' }}
        style={{ transformOrigin: 'left center' }}
        className="absolute left-full top-0 z-30 ml-4 hidden w-[320px] rounded-2xl bg-white p-3.5 shadow-[0_12px_40px_rgba(25,31,40,0.12),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60 lg:block"
      >
        <PeekBody person={person} windowDays={windowDays} />
      </motion.div>
    </>
  );
}
