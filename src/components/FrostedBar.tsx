'use client';

import type { ReactNode } from 'react';

/**
 * 상단 고정 바 — 상시 은은한 frost(반투명 화이트+블러), 하단 CTA frost의 미러.
 * 스크롤 스위치 없이 항상 켜져 있어 콘텐츠가 언제나 반투명 너머로 흐릿하게 지나간다.
 * frost 레이어는 바 아래로 길게 뻗고 마스크로 서서히 사라진다 — 경계선·그림자 없음.
 */
export default function FrostedBar({
  children,
  innerClassName = '',
}: {
  children: ReactNode;
  /** 안쪽 컨테이너(페이지 폭 정렬용) 클래스 */
  innerClassName?: string;
}) {
  return (
    <div className="sticky top-0 z-40">
      {/* frost는 바 자기 영역 안 — 밖으로 늘어뜨리면 스크롤 전에도 아래 콘텐츠를 덮어 뿌예진다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white/60 backdrop-blur-lg [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <div className={`relative ${innerClassName}`}>{children}</div>
    </div>
  );
}
