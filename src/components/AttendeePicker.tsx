'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import Avatar from './Avatar';
import ProfilePeek from './ProfilePeek';
import { useIsDesktop } from '../app-state/useIsDesktop';
import { ME_ID, ORG } from '../data/world';
import type { Person } from '../lib/types';

/**
 * 참석자 피커 — 모바일 바텀시트 / 데스크톱 중앙 모달(max-w 480).
 *
 * 20명 조직 풀 검색·멀티 선택(TOGGLE_ATTENDEE는 부모가 소유 — onToggle로 위임).
 * 나(주최자)는 항상 선택·고정(행 비활성). 피커 안에서도 아바타 탭 → 프로필 피크(인라인).
 * 접근성: role=dialog + 포커스 트랩 + ESC 닫기 + 바디 스크롤 잠금 + 닫힐 때 포커스 복원.
 * 부모의 AnimatePresence 안에서 산다 — 배경 페이드, 시트 슬라이드업/모달 스케일 페이드.
 */

/** '박준호' → '준호' — 성을 뗀 호칭. 2글자 이름은 그대로(페이지 공용 관례). */
export function givenName(name: string): string {
  return [...name].length >= 3 ? name.slice(1) : name;
}

/** 이름·역할 부분일치 검색(공백 트림, 역할은 대소문자 무시). 빈 질의는 전원. */
export function filterPeople(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q));
}

/** 하단 확정 버튼 라벨 — 선택된 동료(나 제외) 이름 순서 기준. */
export function confirmLabel(selectedNames: string[]): { label: string; disabled: boolean } {
  if (selectedNames.length === 0) return { label: '함께할 동료를 선택해주세요', disabled: true };
  const first = givenName(selectedNames[0]);
  if (selectedNames.length === 1) return { label: `${first}님과 함께해요`, disabled: false };
  return { label: `${first}님 외 ${selectedNames.length - 1}명과 함께해요`, disabled: false };
}

export interface AttendeePickerProps {
  attendeeIds: string[];
  /** windowFor(deadline) — 피커 안 피크도 같은 창을 본다. */
  windowDays: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

export default function AttendeePicker({ attendeeIds, windowDays, onToggle, onClose }: AttendeePickerProps) {
  const desktop = useIsDesktop();
  const reduced = !!useReducedMotion();
  const [query, setQuery] = useState('');
  const [peekId, setPeekId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // 모바일 시트 드래그 — 그랩바·헤더에서 시작(dragListener=false). 리스트 스크롤과 충돌하지 않는다.
  const dragControls = useDragControls();
  const startDrag = (e: React.PointerEvent) => {
    if (!desktop && !reduced) dragControls.start(e);
  };

  const filtered = useMemo(() => filterPeople(ORG, query), [query]);
  const selectedSet = useMemo(() => new Set(attendeeIds), [attendeeIds]);
  // 선택된 동료(나 제외) — attendeeIds의 선택 순서를 유지한다. unknown id(딥링크)는 널가드로 건너뛴다.
  const selectedNames = useMemo(
    () =>
      attendeeIds
        .filter((id) => id !== ME_ID)
        .map((id) => ORG.find((p) => p.id === id)?.name)
        .filter((n): n is string => !!n),
    [attendeeIds],
  );
  const confirm = confirmLabel(selectedNames);

  // 바디 스크롤 잠금 + 열릴 때 검색 포커스, 닫힐 때 이전 포커스 복원.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  // ESC 닫기 + Tab 포커스 트랩(패널 안 순환).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = [
        ...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
      ];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fade = { duration: reduced ? 0 : 0.2 };
  const panelMotion =
    desktop || reduced
      ? {
          initial: { opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 12 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 12 },
          transition: reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 350, damping: 30 },
        }
      : {
          initial: { y: '100%' },
          animate: { y: 0 },
          exit: { y: '100%' },
          transition: { type: 'spring' as const, stiffness: 350, damping: 34 },
        };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      {/* 배경 딤 — 탭으로 닫기 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-[#191F28]/45"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="참석자 선택"
        {...panelMotion}
        drag={desktop || reduced ? false : 'y'}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 600) onClose();
        }}
        className="relative flex h-[78dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white lg:h-auto lg:max-h-[min(640px,85dvh)] lg:w-[480px] lg:rounded-[24px]"
      >
        {/* 그랩바(모바일) — 아래로 스와이프하면 시트가 닫힌다 */}
        <div aria-hidden className="touch-none pt-2.5 lg:hidden" onPointerDown={startDrag}>
          <div className="mx-auto h-1 w-9 rounded-full bg-border" />
        </div>

        {/* 헤더 — 모바일에선 여기서도 끌어서 닫을 수 있다. X는 데스크톱 전용. */}
        <div
          className="flex touch-none items-center justify-between px-5 pb-1 pt-3 lg:touch-auto lg:pt-5"
          onPointerDown={startDrag}
        >
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-text-strong">함께할 사람을 선택해주세요</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="pressable -mr-2 hidden h-9 w-9 items-center justify-center rounded-full text-text-weak hover:bg-section lg:flex"
          >
            <X size={19} aria-hidden />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-5 pb-2 pt-2">
          <div className="flex h-11 items-center gap-2.5 rounded-xl bg-section px-3.5">
            <Search size={16} className="shrink-0 text-text-weak" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름이나 역할로 검색"
              aria-label="참석자 검색"
              className="h-full w-full bg-transparent text-[16px] text-text-strong outline-none placeholder:text-text-faint lg:text-[15px]"
            />
          </div>
        </div>

        {/* 20명 리스트 — 마지막 행이 frost 아래를 빠져나올 수 있게 하단 여백을 준다. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-1 lg:h-[380px] lg:flex-none">
          {filtered.length === 0 && (
            <p className="py-12 text-center text-[13px] text-text-faint">검색 결과가 없어요</p>
          )}
          {filtered.map((p) => {
            const isMe = p.id === ME_ID;
            const selected = selectedSet.has(p.id);
            return (
              <div key={p.id} className="rounded-xl px-2 transition-colors hover:bg-section/60">
                <div className="flex items-center gap-3 py-1.5">
                  <Avatar person={p} size={28} />
                  <button
                    type="button"
                    disabled={isMe}
                    aria-pressed={selected}
                    onClick={() => onToggle(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-text-strong">
                        {p.name}
                        {isMe && <span className="ml-1.5 text-[12px] font-normal text-text-weak">나 · 주최자</span>}
                      </span>
                      <span className="block truncate text-[12px] text-text-weak">{p.role}</span>
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors ${
                        selected
                          ? isMe
                            ? 'bg-primary/35 text-white'
                            : 'bg-primary text-white'
                          : 'text-transparent ring-1 ring-border'
                      }`}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                  </button>
                  {/* 일정 펼침 — 보이는 어포던스. 아바타 숨은 탭을 대체한다. */}
                  <button
                    type="button"
                    aria-expanded={peekId === p.id}
                    aria-label={`${p.name} 일정 보기`}
                    onClick={() => setPeekId((cur) => (cur === p.id ? null : p.id))}
                    className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-section hover:text-text-weak"
                  >
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={`transition-transform duration-200 ${peekId === p.id ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {peekId === p.id && <ProfilePeek person={p} windowDays={windowDays} mode="inline" />}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* 확정 — 경계선 대신 frost: 리스트가 반투명 너머로 흐릿하게 지나간다. */}
        <div className="relative -mt-9 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5 lg:pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-4 bottom-0 bg-white/60 backdrop-blur-lg [mask-image:linear-gradient(to_top,black_55%,transparent)]"
          />
          <button
            type="button"
            disabled={confirm.disabled}
            onClick={onClose}
            className="pressable relative h-[54px] w-full rounded-2xl bg-primary text-[16px] font-semibold text-white active:bg-primary-pressed disabled:bg-section disabled:text-text-faint"
          >
            {confirm.label}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
