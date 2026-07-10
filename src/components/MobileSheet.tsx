'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';

/** 모바일 바텀시트 — 딤 + 그랩바 + 스프링. 아코디언 대신 토스의 시트 문법. */
export default function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const reduced = !!useReducedMotion();
  // 시트 계약: 그랩바·타이틀에서 끌어 아래로 스와이프하면 닫힌다(AttendeePicker와 동일 문법).
  // dragListener=false — 본문 스크롤과 충돌하지 않게 그랩 영역에서만 드래그를 시작한다.
  const dragControls = useDragControls();
  const startDrag = (e: React.PointerEvent) => {
    if (!reduced) dragControls.start(e);
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            drag={reduced ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[24px] bg-white lg:hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 32 }}
          >
            {/* 그랩바 + 타이틀 — 여기서 끌어서 닫는다. */}
            <div className="touch-none px-5 pb-2 pt-3" onPointerDown={startDrag}>
              <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-border" />
              <p className="pt-5 text-[18px] font-bold tracking-[-0.01em] text-text-strong">{title}</p>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto px-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

