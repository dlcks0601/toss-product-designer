'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { useIsDesktop } from '../app-state/useIsDesktop';

/**
 * 커스텀 셀렉트 — 시스템 <select>를 대체하는 토스 문법 피커.
 *
 * 트리거: grey100 박스(h-52, r16) + 열림 시 셰브론 180° 회전.
 * 데스크톱: 필드 아래 팝오버 — 스프링(400/30) 스케일·페이드, 선택 항목 파랑+체크,
 *   열릴 때 선택 항목으로 스크롤, 바깥 클릭·ESC 닫기.
 * 모바일: 바텀시트 — 그랩바 + 아래로 스와이프 닫기(참석자 피커와 같은 문법),
 *   딤 탭·ESC 닫기, 바디 스크롤 잠금. 탭하면 즉시 선택·닫힘.
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
  // 팝오버 리스트 최대 높이 — 아래 공간 + 페이지 스크롤 여력까지 계산해 정한다(잘림 방지).
  const [listMaxH, setListMaxH] = useState(264);
  const desktop = useIsDesktop();
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const current = options.find((o) => o.value === value);

  /**
   * 팝오버는 항상 아래로 연다(방향이 바뀌면 공간 감각이 깨진다).
   * 뷰포트 아래 공간이 모자라면 페이지가 딱 그만큼 부드럽게 따라 내려간다 —
   * 의도된 동행 스크롤. 스크롤 여력까지 다 써도 모자랄 때만 리스트 높이를 줄인다.
   */
  const toggleOpen = () => {
    if (!open && !desktop) {
      setOpen(true);
      return;
    }
    if (!open) {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) {
        const LIST_MAX = 264;
        const PANEL_CHROME = 12 + 6; // 패널 패딩(p-1.5×2) + 트리거와의 간격
        const MARGIN = 16; // 화면 가장자리 숨 쉴 틈
        const listH = Math.min(LIST_MAX, options.length * 44);
        const below = window.innerHeight - r.bottom - PANEL_CHROME - MARGIN;
        const doc = document.documentElement;
        const scrollCapacity = Math.max(0, doc.scrollHeight - window.innerHeight - window.scrollY);
        const need = listH - below;
        if (need > 0 && scrollCapacity > 0) {
          window.scrollBy({ top: Math.min(need, scrollCapacity), behavior: reduced ? 'auto' : 'smooth' });
        }
        setListMaxH(Math.max(132, Math.min(listH, below + scrollCapacity)));
      }
    }
    setOpen((v) => !v);
  };

  // 바깥 클릭(데스크톱 팝오버) + ESC 닫기
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

  // 열릴 때 선택 항목이 보이게 — 리스트 내부만 스크롤한다.
  // scrollIntoView는 페이지(조상 스크롤러)까지 움직여 화면이 튀므로 금지.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const list = listRef.current;
      const sel = list?.querySelector<HTMLElement>('[data-selected="true"]');
      if (!list || !sel) return;
      const listRect = list.getBoundingClientRect();
      const selRect = sel.getBoundingClientRect();
      list.scrollTop += selRect.top - listRect.top - list.clientHeight / 2 + sel.clientHeight / 2;
    });
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

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
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
              style={{ maxHeight: listMaxH }}
            >
              {options.map(optionRow)}
            </div>
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
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[64dvh] flex-col rounded-t-[24px] bg-white"
          >
            {/* 그랩바 — 여기서 끌어내리면 닫힌다 */}
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
              className="touch-none px-5 pb-2 pt-3 text-[18px] font-bold tracking-[-0.01em] text-text-strong"
              onPointerDown={(e) => {
                if (!reduced) dragControls.start(e);
              }}
            >
              {ariaLabel}
            </p>
            <div
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-1"
            >
              {options.map(optionRow)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
