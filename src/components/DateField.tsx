'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { buildMonthCells } from './HomeCalendar';
import MobileSheet from './MobileSheet';
import { useIsDesktop } from '../app-state/useIsDesktop';
import { fmtDayKorean } from '../lib/time';

/**
 * 날짜 필드 — PC는 필드 아래 달력 그리드 팝오버(홈 월간 피커 문법),
 * 모바일은 '날짜 선택하기' 바텀시트 + 체크 행(토스 셀렉트 실물 문법, 2026-07-10 확정).
 * 시트는 공용 MobileSheet — 그랩바 + 아래 스와이프 닫기 계약을 그대로 따른다.
 */

const WEEKDAY_HEADER = ['일', '월', '화', '수', '목', '금', '토'] as const;

export default function DateField({
  value,
  onChange,
  selectable,
  dotted,
  ariaLabel = '날짜',
}: {
  value: string;
  onChange: (day: string) => void;
  /** 고를 수 있는 날들(영업일 창) — 밖의 날은 비활성. */
  selectable: string[];
  /** 일정이 있는 날 — 날짜 밑 점(홈 월간 피커와 같은 힌트). */
  dotted?: Set<string>;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectableSet = new Set(selectable);

  // 바깥 탭/클릭 + ESC 닫기 — 스페이서 회수까지 close()로.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  /** PC = 필드 아래 팝오버, 모바일 = 바텀시트(토스 셀렉트 문법). */
  const toggleOpen = () => setOpen((o) => !o);

  const pick = (day: string) => {
    onChange(day);
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className="pressable flex h-[52px] w-full items-center justify-between rounded-2xl bg-section pl-4 pr-4 text-[16px] font-medium text-text-strong lg:text-[15px]"
      >
        <span className="truncate">{fmtDayKorean(value)}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-text-weak transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && desktop && (
          <motion.div
            key="popover"
            role="dialog"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
            style={{ transformOrigin: 'top' }}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-40 rounded-[24px] bg-white p-5 shadow-[0_16px_40px_rgba(25,31,40,0.14),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60"
          >
            {/* 팝오버 폭 = 필드 폭 — 시간 피커와 같은 규칙(열린 것이 연 것과 정렬된다). */}
            <div className="grid grid-cols-7 pb-2">
              {WEEKDAY_HEADER.map((d) => (
                <span key={d} className="py-1 text-center text-[13px] text-text-faint">
                  {d}
                </span>
              ))}
            </div>
            {/* PC 행간 28px — 패널이 폭 416과 같은 정사각 비율(≈407)이 된다. 모바일은 확정 규격(14px). */}
            <div className="grid grid-cols-7 gap-y-3.5 lg:gap-y-7">
              {buildMonthCells().map(({ day, inMonth }) => {
                const enabled = inMonth && selectableSet.has(day);
                const isSel = day === value;
                const dot = enabled && dotted?.has(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!enabled}
                    aria-pressed={isSel}
                    onClick={() => pick(day)}
                    className={`pressable relative mx-auto flex h-11 w-11 items-center justify-center rounded-[14px] text-[16px] font-semibold ${
                      isSel
                        ? 'bg-primary text-white'
                        : enabled
                          ? 'text-text-strong hover:bg-section'
                          : inMonth
                            ? 'text-text-faint'
                            : 'text-border'
                    }`}
                  >
                    {Number(day.slice(8, 10))}
                    {dot && !isSel && (
                      <span aria-hidden className="absolute bottom-[3px] h-1 w-1 rounded-full bg-primary/60" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 모바일 — '날짜 선택하기' 바텀시트, 체크 행(토스 셀렉트 문법). */}
      <MobileSheet open={open && !desktop} onClose={close} title="날짜 선택하기">
        <div className="pb-2">
          {/* 토스 시트 캐스케이드 — 행이 제자리에서 한 장씩 켜진다(순수 페이드 60ms 스태거 — 이동·물결 없음, 12행까지). */}
          {selectable.map((day, i) => {
            const isSel = day === value;
            return (
              <motion.button
                key={day}
                type="button"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i, 12) * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => pick(day)}
                aria-pressed={isSel}
                className="pressable flex min-h-[52px] w-full items-center gap-2 py-2 text-left"
              >
                <span className="text-[16px] font-medium text-text-strong">{fmtDayKorean(day)}</span>
                {dotted?.has(day) && <span aria-hidden className="h-1 w-1 rounded-full bg-primary/60" />}
                <Check
                  size={22}
                  strokeWidth={3}
                  aria-hidden
                  className={`ml-auto shrink-0 ${isSel ? 'text-primary' : 'text-[#D6DBE0]'}`}
                />
              </motion.button>
            );
          })}
        </div>
      </MobileSheet>
    </div>
  );
}
