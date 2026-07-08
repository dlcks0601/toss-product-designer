'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { buildMonthCells } from './HomeCalendar';
import { fmtDayKorean } from '../lib/time';

/**
 * 날짜 필드 — 리스트가 아니라 달력 그리드에서 고른다(홈 월간 피커와 같은 문법).
 * 모바일·데스크톱 모두 필드 아래 팝오버 — 날짜는 필드 곁에서 고르는 게 맥락에 맞고
 * (토스 메뉴 원칙: 누른 자리 가까이), 바텀시트는 여정을 끊는 과한 전환이라 쓰지 않는다.
 * 그리드는 컴팩트 정사각(셀 36px) — 화면을 넘치지 않게. 공간이 모자라면 페이지가
 * 딱 그만큼 부드럽게 따라 내려온다(시간 피커와 같은 동행 스크롤).
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
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  // 동적 스페이서 — 팝오버가 열릴 때만 페이지 하단에 임시 공간을 만들고, 닫히면 회수한다.
  // (상시 하단 패딩은 평소 화면에 불필요한 스크롤을 만든다.)
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const scrolledByRef = useRef(0);
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

  /** 닫기 — 열 때 내려간 만큼 부드럽게 원위치하고 스페이서를 회수한다. */
  const close = () => {
    setOpen(false);
    const sp = spacerRef.current;
    if (sp) {
      const back = scrolledByRef.current;
      spacerRef.current = null;
      scrolledByRef.current = 0;
      if (back > 0) window.scrollBy({ top: -back, behavior: reduced ? 'auto' : 'smooth' });
      window.setTimeout(() => sp.remove(), 400);
    }
  };

  /** 항상 아래로 열고, 공간이 모자라면 딱 그만큼 임시 공간을 만들어 따라 내려간다. */
  const toggleOpen = () => {
    if (open) {
      close();
      return;
    }
    const r = rootRef.current?.getBoundingClientRect();
    if (r) {
      // 패널 높이: 모바일 콤팩트(~330) / 데스크톱 홈 규격(~400).
      const panelH = window.matchMedia('(min-width: 1024px)').matches ? 400 : 330;
      // 여백 24px + 하단 고정 CTA(~96px) 위까지 — 패널이 바닥/CTA에 붙지 않게.
      const below = window.innerHeight - r.bottom - 6 - 24 - 96;
      const need = panelH - below;
      if (need > 0) {
        const sp = document.createElement('div');
        sp.style.height = `${need + 8}px`;
        sp.setAttribute('aria-hidden', 'true');
        document.body.appendChild(sp);
        spacerRef.current = sp;
        scrolledByRef.current = need;
        window.scrollBy({ top: need, behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    setOpen(true);
  };

  // 언마운트 시 스페이서 정리
  useEffect(() => () => spacerRef.current?.remove(), []);

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
        {open && (
          <motion.div
            key="popover"
            role="dialog"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
            style={{ transformOrigin: 'top' }}
            className="absolute left-1/2 top-[calc(100%+6px)] z-40 w-[296px] -translate-x-1/2 rounded-[20px] bg-white p-4 shadow-[0_16px_40px_rgba(25,31,40,0.14),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60 lg:left-0 lg:w-[340px] lg:translate-x-0 lg:rounded-[24px] lg:p-5"
          >
            {/* 홈 월간 피커(7월 탭) 문법 — 모바일은 콤팩트, 데스크톱은 홈 규격 */}
            <div className="grid grid-cols-7 pb-1 lg:pb-2">
              {WEEKDAY_HEADER.map((d) => (
                <span key={d} className="py-0.5 text-center text-[11px] text-text-faint lg:py-1 lg:text-[13px]">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1.5 lg:gap-y-3">
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
                    className={`pressable relative mx-auto flex h-9 w-9 items-center justify-center rounded-[11px] text-[14px] font-semibold lg:h-10 lg:w-10 lg:rounded-[13px] lg:text-[16px] ${
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
                      <span aria-hidden className="absolute bottom-[2px] h-1 w-1 rounded-full bg-primary/60 lg:bottom-[3px]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
