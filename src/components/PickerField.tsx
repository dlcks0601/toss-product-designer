'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * 커스텀 셀렉트 — 시스템 <select>를 대체하는 토스 문법 피커.
 *
 * 트리거: grey100 박스(h-52, r16) + 열림 시 셰브론 180° 회전.
 * 모바일·데스크톱 모두 필드 아래 팝오버 — 시간·날짜는 필드 곁에서 고르는 게 맥락에
 * 맞고(토스 메뉴 원칙: 누른 자리 가까이), 바텀시트는 여정을 끊는 과한 전환이라 안 쓴다.
 * 스프링(400/30) 스케일·페이드, 선택 항목 파랑+체크, 열릴 때 선택 항목으로 내부 스크롤,
 * 바깥 탭·ESC 닫기. 공간이 모자라면 페이지가 딱 그만큼 따라 내려온다(동행 스크롤).
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
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 동적 스페이서 — 열릴 때만 하단에 임시 공간을 만들고 닫히면 회수한다(DateField와 동일 계약).
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const scrolledByRef = useRef(0);
  const current = options.find((o) => o.value === value);

  /**
   * 팝오버는 항상 아래로 연다(방향이 바뀌면 공간 감각이 깨진다).
   * 뷰포트 아래 공간이 모자라면 페이지가 딱 그만큼 부드럽게 따라 내려간다 —
   * 의도된 동행 스크롤. 스크롤 여력까지 다 써도 모자랄 때만 리스트 높이를 줄인다.
   */
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

  const toggleOpen = () => {
    if (open) {
      close();
      return;
    }
    const r = rootRef.current?.getBoundingClientRect();
    if (r) {
      const LIST_MAX = 264;
      const PANEL_CHROME = 12 + 6; // 패널 패딩(p-1.5×2) + 트리거와의 간격
      const MARGIN = 24 + 96; // 화면 가장자리 숨 쉴 틈 + 하단 고정 CTA 가드
      const listH = Math.min(LIST_MAX, options.length * 44);
      const below = window.innerHeight - r.bottom - PANEL_CHROME - MARGIN;
      const need = listH - below;
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
        {open && (
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
    </div>
  );
}
