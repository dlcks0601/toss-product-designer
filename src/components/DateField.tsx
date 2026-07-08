'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { buildMonthCells } from './HomeCalendar';
import { useIsDesktop } from '../app-state/useIsDesktop';
import { fmtDayKorean } from '../lib/time';

/**
 * 날짜 필드 — 리스트가 아니라 달력 그리드에서 고른다(홈 월간 피커와 같은 문법).
 * 트리거·오버레이 셸은 PickerField와 동일: 데스크톱 = 필드 아래 팝오버(항상 아래,
 * 공간이 모자라면 페이지가 부드럽게 따라 내려온다), 모바일 = 그랩바 바텀시트.
 * 선택 가능일(selectable) 밖의 날은 흐리게 비활성, 일정 있는 날엔 점(dotted).
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
  const dragControls = useDragControls();
  const selectableSet = new Set(selectable);

  // 바깥 클릭 + ESC 닫기 (PickerField와 동일 계약)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 모바일 시트 — 바디 스크롤 잠금
  useEffect(() => {
    if (!open || desktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, desktop]);

  /** 데스크톱: 항상 아래로 열고, 공간이 모자라면 페이지가 딱 그만큼 따라 내려온다. */
  const toggleOpen = () => {
    if (!open && desktop) {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) {
        const PANEL_H = 400; // 그리드 팝오버 높이(대략)
        const below = window.innerHeight - r.bottom - 18 - 16;
        const doc = document.documentElement;
        const scrollCapacity = Math.max(0, doc.scrollHeight - window.innerHeight - window.scrollY);
        const need = PANEL_H - below;
        if (need > 0 && scrollCapacity > 0) {
          window.scrollBy({ top: Math.min(need, scrollCapacity), behavior: reduced ? 'auto' : 'smooth' });
        }
      }
    }
    setOpen((v) => !v);
  };

  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  const grid = (
    <div>
      <div className="grid grid-cols-7 pb-1">
        {WEEKDAY_HEADER.map((d) => (
          <span key={d} className="py-1 text-center text-[12px] text-text-faint">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1.5">
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
              className={`pressable relative mx-auto flex h-10 w-10 items-center justify-center rounded-[13px] text-[15px] font-semibold ${
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
    </div>
  );

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
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
            style={{ transformOrigin: 'top' }}
            className="absolute left-0 top-[calc(100%+6px)] z-40 w-[340px] rounded-[24px] bg-white p-4 shadow-[0_16px_40px_rgba(25,31,40,0.14),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60"
          >
            {grid}
          </motion.div>
        )}

        {open && !desktop && (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-[#191F28]/45"
          />
        )}
        {open && !desktop && (
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 34 }}
            drag={reduced ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 600) setOpen(false);
            }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white"
          >
            <div
              aria-hidden
              className="touch-none pt-2.5"
              onPointerDown={(e) => {
                if (!reduced) dragControls.start(e);
              }}
            >
              <div className="mx-auto h-1 w-9 rounded-full bg-border" />
            </div>
            <p
              className="touch-none px-5 pb-2 pt-5 text-[18px] font-bold tracking-[-0.01em] text-text-strong"
              onPointerDown={(e) => {
                if (!reduced) dragControls.start(e);
              }}
            >
              {ariaLabel}
            </p>
            <div className="px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">{grid}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
