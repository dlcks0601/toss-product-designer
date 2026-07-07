'use client';

/**
 * 웰컴 카드 — 첫 방문 1회, 캘린더 위에 얹히는 친근한 카드(모달 딤 없음).
 * 심사자의 첫 3분: 미션을 한 문장으로 쥐여 주고 여정 A로 바로 안내한다.
 * 표시 여부(welcomeDismissed)는 reducer state가 소유한다 — localStorage 금지.
 */
export interface WelcomeCardProps {
  /** 회의 잡아보기 — 6인 프리필 + 셋업 진입(할 일 카드와 동일 경로) */
  onStart: () => void;
  /** 천천히 둘러볼게요 — 카드만 접는다 */
  onDismiss: () => void;
}

export default function WelcomeCard({ onStart, onDismiss }: WelcomeCardProps) {
  return (
    <div className="rounded-card bg-white p-5 shadow-[0_12px_40px_rgba(25,31,40,0.10),0_2px_8px_rgba(25,31,40,0.05)] ring-1 ring-border/60 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:p-6">
      <div className="min-w-0">
        <p className="break-keep text-[17px] font-bold leading-[1.4] tracking-[-0.01em] text-text-strong lg:text-[19px]">
          동료 6명과 다음 주까지 1시간 회의를 잡아야 해요
        </p>
        <p className="mt-1 break-keep text-[13.5px] leading-[1.5] text-text-body lg:text-[14px]">
          캘린더가 모두의 상황을 읽고 좋은 시간을 찾아드려요
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 lg:mt-0 lg:shrink-0">
        <button
          type="button"
          onClick={onStart}
          className="pressable h-11 flex-1 whitespace-nowrap rounded-xl bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-pressed lg:flex-none"
        >
          회의 잡아보기
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="pressable h-11 whitespace-nowrap rounded-xl px-4 text-[14px] font-medium text-text-weak hover:bg-section"
        >
          천천히 둘러볼게요
        </button>
      </div>
    </div>
  );
}
