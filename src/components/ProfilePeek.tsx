'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Person } from '../lib/types';
import { deriveInsights } from '../lib/insights';
import { weekdayIndex } from '../lib/time';
import { DAY_END, eventsOn, yPct, KIND_STYLE, kindBoxStyle } from './HomeCalendar';

/**
 * 프로필 피크('다' 안) — 헤더 없음. 참석자 행 아래 인라인(모바일)/행 옆 팝오버(데스크톱).
 *
 * 내용은 전부 파생이다(하드코딩 금지 계약):
 *  - 미니 주간 캘린더 = 기한 창(windowFor(deadline))의 앞 5영업일 × person.events 실제 블록.
 *    kind별 틴트는 HomeCalendar의 KIND_STYLE을 그대로 공유한다(단일 소스).
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

/** 피크 본문 — 미니 주간 블록 + 각주. 컨테이너(인라인/팝오버)가 감싼다. */
function PeekBody({ person, windowDays, onWhite }: { person: Person; windowDays: string[]; onWhite: boolean }) {
  const days = peekDays(windowDays);
  const headline = useMemo(() => deriveInsights(person, windowDays).headline, [person, windowDays]);

  return (
    <div role="region" aria-label={`${person.name}님의 일정 미리보기`}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => (
          <div key={day} className="min-w-0">
            <p className="text-center text-[10px] font-medium leading-none text-text-weak">
              {WEEKDAY_SHORT[weekdayIndex(day)]} {Number(day.slice(8, 10))}
            </p>
            <div
              className={`relative mt-1.5 h-[104px] overflow-hidden rounded-[6px] ${
                onWhite ? 'bg-section/60' : 'bg-white'
              }`}
            >
              {eventsOn(person.events, day).map((ev) => {
                const top = yPct(ev.start);
                const height = Math.max(yPct(Math.min(ev.end, DAY_END)) - top, 4);
                return (
                  <div
                    key={ev.id}
                    className="absolute inset-x-[2px] overflow-hidden rounded-[3px] border px-[3px] py-px"
                    style={{ top: `${top}%`, height: `calc(${height}% - 1px)`, ...kindBoxStyle(ev.kind) }}
                  >
                    <p
                      className="truncate text-[8px] font-semibold leading-[1.25]"
                      style={{ color: KIND_STYLE[ev.kind].title }}
                    >
                      {ev.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
      <div className="mb-2 mt-1 rounded-2xl bg-section p-3">
        <PeekBody person={person} windowDays={windowDays} onWhite={false} />
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
        <PeekBody person={person} windowDays={windowDays} onWhite />
      </motion.div>
    </>
  );
}
