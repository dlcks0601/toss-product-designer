'use client';

import type { ReactNode } from 'react';
import useScrolled from '../lib/useScrolled';

/**
 * 스크롤하면 반투명 화이트+블러로 얼어붙는 상단 고정 바 — 토스 헤더 문법.
 * frost 레이어는 바 아래로 길게 뻗고 마스크로 서서히 사라진다 — 경계선·그림자 없이
 * 콘텐츠가 자연스럽게 흐릿해지며 넘어간다.
 */
export default function FrostedBar({
  children,
  innerClassName = '',
}: {
  children: ReactNode;
  /** 안쪽 컨테이너(페이지 폭 정렬용) 클래스 */
  innerClassName?: string;
}) {
  const scrolled = useScrolled();
  return (
    <div className="sticky top-0 z-40">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 -bottom-10 top-0 bg-white/60 backdrop-blur-lg transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,black_45%,transparent)] ${
          scrolled ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className={`relative ${innerClassName}`}>{children}</div>
    </div>
  );
}
