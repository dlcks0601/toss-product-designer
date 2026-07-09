'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Reveal from './Reveal';
import { SCAN_STEP_MS, finalScanLine, scanSteps, scanTimeline } from '../lib/scan';
import type { Person } from '../lib/types';

/**
 * 스캔 모먼트 — '시간 찾아보기' 직후 딱 1회(~7초). 해외송금 진행 화면의 문법으로:
 * 라이트 무대 + 세로 3스텝 타임라인. "지금 일하는 자리만 빛이 산다."
 *
 * - 활성 도트: 작은 파란 점 + 옅은 헤일로가 숨 쉰다(회전·플레어·구면 음영 금지 — 평평한 빛만).
 * - 활성 타이틀: 저대비 시머 그라데이션이 왼→오로 흐른다(같은 글자 이중 레이어 크로스페이드).
 * - 레일: 설명 자리를 상시 확보해 길이가 절대 변하지 않고, 지나간 길은 파랑 필이
 *   스텝 박자(1.9s)에 맞춰 차오른다 — 빛이 같은 길이를 타고 내려간다.
 * - 배경: 종류색 파스텔 블롭 4장이 각자 궤도로 표류(수렴 없음) — 검정 헤드라인을 해치지 않는 밝기.
 * - 마무리: 헤드라인이 '모두 가능한 N을 찾았어요'로 크로스페이드, 한 박자 뒤 onDone.
 *
 * 재생 1회 보장(scanPlayed)과 reduced-motion 생략은 부모(find 화면)가 게이트한다 —
 * 여기 도달하면 항상 끝까지 재생하고, 언마운트 시 타이머를 전부 정리한다.
 */

export interface ScanMomentProps {
  attendees: Person[];
  /** 회의 길이 — 마무리 문장('모두 가능한 1시간을 찾았어요')의 길이 표현 */
  duration: 30 | 60 | 90;
  onDone: () => void;
}

/** 배경 블롭 — 위치·크기·색·궤도(globals의 scan-drift-*). 하늘·라벤더·분홍·버터 파스텔 4색.
 *  각 색이 코너 하나씩을 소유하고 이음새에서만 섞인다 — 전부 겹치면 색이 죽는다(머디 워시 금지).
 *  가운데는 가장 밝게 남아 검정 헤드라인의 자리가 된다. */
const BLOBS = [
  'scan-blob-a left-[-12%] top-[-18%] h-[52vmax] w-[52vmax] bg-[#A8DCFF] opacity-60',
  'scan-blob-b right-[-10%] top-[-16%] h-[46vmax] w-[46vmax] bg-[#D3C4FF] opacity-55',
  'scan-blob-c bottom-[-22%] left-[-12%] h-[48vmax] w-[48vmax] bg-[#FFD1DF] opacity-55',
  'scan-blob-d bottom-[-24%] right-[-12%] h-[50vmax] w-[50vmax] bg-[#FFE9B5] opacity-55',
  // 가운데 — 코너 색들의 다리(연한 페리윙클). 헤드라인 가독을 지키는 가장 옅은 톤.
  'scan-blob-e left-[18%] top-[22%] h-[55vmax] w-[55vmax] bg-[#CFE0FF] opacity-45',
];

export default function ScanMoment({ attendees, duration, onDone }: ScanMomentProps) {
  const steps = useMemo(() => scanSteps(attendees.length), [attendees.length]);
  const timeline = useMemo(() => scanTimeline(steps.length), [steps.length]);
  /** 진행 위상 — 활성 스텝 인덱스(0..N-1), N이면 마무리 비트. */
  const [phase, setPhase] = useState(0);
  // onDone은 dispatch 클로저 — 최신 참조만 유지하고 타이머는 마운트 1회만 건다.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timers = [
      // 첫 스텝(0ms)은 초기 상태 — 이후 스텝 전환만 타이머로.
      ...timeline.stepAt.slice(1).map((at, i) => window.setTimeout(() => setPhase(i + 1), at)),
      window.setTimeout(() => setPhase(steps.length), timeline.finaleAt),
      window.setTimeout(() => onDoneRef.current(), timeline.doneAt),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, [timeline, steps.length]);

  const finale = phase >= steps.length;

  return (
    <Reveal className="w-full">
      <section
        aria-label={`${attendees.length}명의 다음 주를 읽는 중`}
        className="relative flex min-h-dvh w-full overflow-hidden bg-bg"
      >
        {/* 배경 — 파스텔 블롭 표류(은은하게, 각자 제 궤도로) */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {BLOBS.map((cls) => (
            <span key={cls} className={`absolute rounded-full blur-[60px] ${cls}`} />
          ))}
        </div>

        <div className="relative mx-auto flex w-full max-w-[420px] flex-col justify-center px-6 py-16">
          <p className="text-[13px] font-semibold text-text-weak">
            {attendees.length}명의 다음 주를 읽는 중
          </p>

          {/* 헤드라인 — 마무리에 '찾았어요'로 크로스페이드(자리 고정) */}
          <div className="relative mt-1.5 h-[34px]">
            <AnimatePresence initial={false}>
              <motion.h2
                key={finale ? 'found' : 'finding'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 truncate text-[24px] font-bold leading-[34px] tracking-[-0.02em] text-text-strong"
              >
                {finale ? finalScanLine(duration) : '좋은 시간을 찾고 있어요'}
              </motion.h2>
            </AnimatePresence>
          </div>

          {/* 세로 스텝 타임라인 — 레일 길이 불변, 빛만 내려간다 */}
          <div className="mt-10">
            {steps.map((s, i) => {
              const active = phase === i;
              const done = phase > i;
              const last = i === steps.length - 1;
              return (
                <div key={s.title} className="grid grid-cols-[22px_1fr] gap-x-4">
                  <div className="flex flex-col items-center">
                    {/* 도트 3태 — 대기 회색 점 / 활성 파란 점+헤일로 / 완료 파란 점 */}
                    <div className="relative h-[22px] w-[22px] shrink-0">
                      <span
                        aria-hidden
                        className={`absolute inset-[7px] rounded-full bg-border transition-opacity duration-300 ${
                          active || done ? 'opacity-0' : 'opacity-100'
                        }`}
                      />
                      <span
                        aria-hidden
                        className={`absolute inset-0 transition-opacity duration-300 ${
                          active ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <span
                          className="scan-halo absolute -inset-[7px] rounded-full"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(49,130,246,.28), rgba(49,130,246,.10) 55%, transparent 72%)',
                          }}
                        />
                        <span className="absolute inset-[6px] rounded-full bg-primary" />
                      </span>
                      <span
                        aria-hidden
                        className={`absolute inset-[7px] rounded-full bg-primary transition-[opacity,transform] duration-300 ${
                          done ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                        }`}
                      />
                    </div>
                    {/* 레일 — 활성되는 순간부터 스텝 박자에 맞춰 파랑 필이 차오른다 */}
                    {!last && (
                      <div className="relative my-[5px] min-h-[18px] w-[3px] flex-1 overflow-hidden rounded-full bg-section">
                        <span
                          aria-hidden
                          className="absolute inset-0 origin-top rounded-full bg-gradient-to-b from-[#4593FC] to-[#AECFFF]"
                          style={{
                            transform: 'scaleY(0)',
                            animation:
                              phase >= i ? `scan-fill ${SCAN_STEP_MS}ms linear forwards` : 'none',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className={last ? '' : 'pb-6'}>
                    {/* 타이틀 이중 레이어 — 베이스(회색 상태들) 위에 시머 그라데이션이 활성 구간만 켜진다 */}
                    <p className="relative mt-px text-[15.5px] font-bold leading-[1.4]">
                      <span
                        className={`transition-colors duration-300 ${
                          active ? 'text-transparent' : done ? 'text-text-weak' : 'text-text-faint'
                        }`}
                      >
                        {s.title}
                      </span>
                      <span
                        aria-hidden
                        className={`scan-title-sheen absolute inset-0 transition-opacity duration-300 ${
                          active ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {s.title}
                      </span>
                    </p>
                    {/* 설명 — 자리는 상시 확보(레일 길이 불변), 투명도로만 등장·퇴장 */}
                    <p
                      className={`mt-[5px] text-[13px] leading-[1.5] text-[#7291C9] transition-opacity duration-300 ${
                        active ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {s.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Reveal>
  );
}
