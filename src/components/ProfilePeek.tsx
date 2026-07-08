'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Person } from '../lib/types';
import { deriveInsights } from '../lib/insights';
import { fmtRange, weekdayIndex } from '../lib/time';
import { eventsOn } from './HomeCalendar';

/**
 * 프로필 피크('다' 안) — 헤더 없음. 참석자 행 아래 인라인(모바일)/행 옆 팝오버(데스크톱).
 *
 * 형식: 하루 한 줄 텍스트 다이제스트 — "수 8  집중 작업 · 데이터 리뷰".
 * 미니 캘린더 그리드는 읽는 게 아니라 해독하는 화면이라 버렸다(토스 소비 캘린더 문법).
 * 점심은 줄에서 빼고 맨 아래 리듬 각주가 대신 말한다.
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

/** 피크 본문 — 하루 한 줄 텍스트 다이제스트 + 각주. 컨테이너(인라인/팝오버)가 감싼다. */
function PeekBody({ person, windowDays }: { person: Person; windowDays: string[] }) {
  const days = peekDays(windowDays);
  const headline = useMemo(() => deriveInsights(person, windowDays).headline, [person, windowDays]);

  return (
    <div role="region" aria-label={`${person.name}님의 일정 미리보기`}>
      <div className="space-y-3">
        {days.map((day) => {
          // 점심은 줄에서 뺀다 — 맨 아래 리듬 각주가 대신 말한다.
          const items = eventsOn(person.events, day).filter((ev) => ev.kind !== 'lunch');
          return (
            <div key={day}>
              <p className="text-[11px] font-semibold leading-none text-text-weak">
                {WEEKDAY_SHORT[weekdayIndex(day)]} {Number(day.slice(8, 10))}일
              </p>
              {items.length === 0 ? (
                <p className="mt-1.5 text-[12px] leading-[1.4] text-text-faint">일정 없음</p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {items.map((ev) => (
                    <li key={ev.id} className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-[1.35] text-text-strong">{ev.title}</p>
                      <p className="mt-px truncate text-[11.5px] leading-[1.35] text-text-weak">
                        {fmtRange(ev.start, ev.end)}
                        {ev.room ? ` · ${ev.room}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
