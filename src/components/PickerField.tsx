'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import MobileSheet from './MobileSheet';
import { useIsDesktop } from '../app-state/useIsDesktop';

/**
 * 커스텀 셀렉트 — 시스템 <select>를 대체하는 토스 문법 피커.
 * 트리거: grey100 박스(h-52, r16) + 열림 시 셰브론 180° 회전.
 * PC = 필드 아래 팝오버(누른 자리 가까이), 모바일 = '~ 선택하기' 바텀시트 + 체크 행
 * (토스 셀렉트 실물 문법, 2026-07-10 확정 — 공용 MobileSheet, 스와이프 닫기 계약 포함).
 * 열릴 때 선택 항목이 보이게 컨테이너 내부만 스크롤한다.
 */

export interface PickerOption {
  value: string;
  label: string;
}

export default function PickerField({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  const close = () => setOpen(false);
  /** PC = 필드 아래 팝오버, 모바일 = '시간 선택하기' 바텀시트(토스 셀렉트 문법). */
  const toggleOpen = () => setOpen((o) => !o);

  // 바깥 클릭 + ESC 닫기 — 스페이서 회수까지 close()로.
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

  // 열릴 때 선택 항목이 보이게 — 열린 컨테이너(팝오버 리스트/시트 본문) 내부만 스크롤한다.
  // scrollIntoView는 페이지(조상 스크롤러)까지 움직여 화면이 튀므로 금지.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const list = listRef.current;
      const sel = list?.querySelector<HTMLElement>('[data-selected="true"]');
      if (!list || !sel) return;
      // 시트에선 스크롤 컨테이너가 시트 본문(부모) — 실제 스크롤러를 찾아 조정한다.
      const scroller = list.scrollHeight > list.clientHeight ? list : (list.parentElement as HTMLElement | null);
      if (!scroller) return;
      const scRect = scroller.getBoundingClientRect();
      const selRect = sel.getBoundingClientRect();
      scroller.scrollTop += selRect.top - scRect.top - scroller.clientHeight / 2 + sel.clientHeight / 2;
    });
  }, [open]);

  const select = (v: string) => {
    onChange(v);
    close();
  };

  const optionRow = (o: PickerOption) => {
    const isSel = o.value === value;
    return (
      <button
        key={o.value}
        type="button"
        role="option"
        aria-selected={isSel}
        data-selected={isSel}
        onClick={() => select(o.value)}
        className={`flex h-11 w-full shrink-0 items-center justify-between rounded-xl px-3.5 text-left text-[16px] transition-colors hover:bg-section lg:text-[15px] ${
          isSel ? 'font-semibold text-primary' : 'font-medium text-text-strong'
        }`}
      >
        {o.label}
        {isSel && <Check size={16} strokeWidth={2.6} aria-hidden />}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      {/* 트리거 — grey100 박스 셀렉트(v2 관례) */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className="pressable flex h-[52px] w-full items-center justify-between rounded-2xl bg-section pl-4 pr-4 text-[16px] font-medium text-text-strong lg:text-[15px]"
      >
        <span className="truncate">{current?.label ?? ''}</span>
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
            className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_rgba(25,31,40,0.14),0_2px_8px_rgba(25,31,40,0.06)] ring-1 ring-border/60"
          >
            <div
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              className="overflow-y-auto"
              style={{ maxHeight: 264 }}
            >
              {options.map(optionRow)}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* 모바일 — '시간 선택하기' 바텀시트, 체크 행(토스 셀렉트 문법). */}
      <MobileSheet open={open && !desktop} onClose={close} title={`${ariaLabel} 선택하기`}>
        <div ref={open && !desktop ? listRef : undefined} className="pb-2">
          {/* 토스 시트 캐스케이드 — 행이 위에서부터 하나씩 쌓인다(30ms 스태거, 12행까지). */}
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <motion.button
                key={o.value}
                type="button"
                data-selected={isSel}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => select(o.value)}
                aria-pressed={isSel}
                className="pressable flex min-h-[52px] w-full items-center justify-between py-2 text-left"
              >
                <span className="text-[16px] font-medium text-text-strong">{o.label}</span>
                <Check
                  size={22}
                  strokeWidth={3}
                  aria-hidden
                  className={`shrink-0 ${isSel ? 'text-primary' : 'text-[#D6DBE0]'}`}
                />
              </motion.button>
            );
          })}
        </div>
      </MobileSheet>
    </div>
  );
}
