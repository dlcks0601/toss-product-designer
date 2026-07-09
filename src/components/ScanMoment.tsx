'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Aurora from './Aurora';
import Avatar from './Avatar';
import Reveal from './Reveal';
import { buildScanSteps, finalScanLine, scanTimeline } from '../lib/scan';
import type { Person, PersonInsights } from '../lib/types';

/**
 * 스캔 모먼트 — '시간 찾아보기' 직후 딱 1회(~1.2초대). 시스템이 참석자들의 캘린더를
 * 실제로 읽는 과정을 보여준다. 장식이 아니라 설명이다: "추천은 사람들의 사정을 읽은 결과".
 *
 * 무대: 다크 카드(#191F28, r20) 위 오로라 'scan'을 저투명 오버레이로 —
 * 지능의 순간에만 허용되는 딥 컨텍스트. 시퀀스는 scan.ts 타임라인이 소유한다:
 * 타이틀 고정 → 아바타 순차 점등(opacity .25→1 + 흰 글로우 링) → 점등과 동기화된
 * scanLine 크로스페이드(전부 insights 실출력 — 하드코딩 금지) → 진행 바(3px, 파랑
 * 그라데이션, 박자 동기) → 마무리 문장(흰색 semibold) → HOLD 후 onDone.
 *
 * 재생 1회 보장(scanPlayed)과 reduced-motion 생략은 부모(find 화면)가 게이트한다 —
 * 여기 도달하면 항상 끝까지 재생하고, 언마운트 시 타이머를 전부 정리한다.
 */

export interface ScanMomentProps {
  attendees: Person[];
  insights: Record<string, PersonInsights>;
  /** 회의 길이 — 마무리 문장('모두 가능한 1시간을 찾았어요')의 길이 표현 */
  duration: 30 | 60 | 90;
  onDone: () => void;
}

export default function ScanMoment({ attendees, insights, duration, onDone }: ScanMomentProps) {
  const steps = useMemo(() => buildScanSteps(attendees, insights), [attendees, insights]);
  const timeline = useMemo(() => scanTimeline(steps.length), [steps.length]);
  /** 점등된 아바타 수(0..N) — 문장·진행 바가 같은 값에서 파생된다 */
  const [lit, setLit] = useState(0);
  /** 마무리 문장 표시 중 */
  const [finale, setFinale] = useState(false);
  // onDone은 dispatch 클로저 — 최신 참조만 유지하고 타이머는 마운트 1회만 건다.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timers = [
      ...timeline.lightAt.map((at, i) => window.setTimeout(() => setLit(i + 1), at)),
      window.setTimeout(() => setFinale(true), timeline.finaleAt),
      window.setTimeout(() => onDoneRef.current(), timeline.doneAt),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, [timeline]);

  const line = finale ? finalScanLine(duration) : lit > 0 ? steps[lit - 1].line : '';
  const progress = steps.length === 0 ? 1 : (finale ? steps.length : lit) / steps.length;

  return (
    <Reveal className="w-full lg:flex lg:justify-center">
      {/* 모바일: 화면 전체가 무대(풀블리드 다크, 콘텐츠 세로 중앙). 데스크톱: 기존 다크 카드. */}
      <section
        aria-label={`${attendees.length}명의 다음 주를 읽고 있어요`}
        className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden bg-[#191F28] px-6 py-7 lg:min-h-0 lg:w-full lg:max-w-[560px] lg:rounded-[20px] lg:px-8 lg:py-9"
      >
        {/* 오로라 'scan' — 다크 카드 위 저투명 오버레이(딥 컨텍스트, 은은하게) */}
        <div aria-hidden className="absolute inset-0 opacity-40">
          <Aurora variant="scan" />
        </div>

        <div className="relative">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-white">
            {attendees.length}명의 다음 주를 읽고 있어요
          </h2>

          {/* 아바타 행 — 순차 점등: opacity .25→1 + 흰 글로우 링 */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            {attendees.map((p, i) => (
              <span
                key={p.id}
                className="inline-flex rounded-full transition-[opacity,box-shadow] duration-300"
                style={{
                  transitionTimingFunction: 'var(--bezier-expo)',
                  opacity: lit > i ? 1 : 0.25,
                  boxShadow:
                    lit > i
                      ? '0 0 0 2px rgba(255,255,255,.85), 0 2px 14px rgba(255,255,255,.35)'
                      : '0 0 0 0 rgba(255,255,255,0)',
                }}
              >
                <Avatar person={p} size={28} />
              </span>
            ))}
          </div>

          {/* 문장 자리 — 점등 동기 크로스페이드. 마무리 문장만 흰색 semibold.
              나가는 문장(120ms)은 점등 간격(≥120ms)보다 먼저 끝난다 — 겹침·적체 방지. */}
          <div className="relative mt-4 h-5">
            <AnimatePresence initial={false}>
              <motion.p
                key={finale ? 'finale' : lit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.22 }}
                className={`absolute inset-0 truncate leading-5 ${
                  finale ? 'text-[13px] font-semibold text-white' : 'text-[12.5px] text-[#D1D6DB]'
                }`}
              >
                {line}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* 진행 바 — 3px 파랑 그라데이션, 점등 박자와 동기(width 트랜지션) */}
          <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3182F6] to-[#50D5FF]"
              style={{
                width: `${progress * 100}%`,
                transition: `width ${timeline.intervalMs}ms var(--bezier-out)`,
              }}
            />
          </div>
        </div>
      </section>
    </Reveal>
  );
}
