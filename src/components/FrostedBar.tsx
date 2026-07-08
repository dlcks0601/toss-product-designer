'use client';

import type { ReactNode } from 'react';
import useScrollProgress from '../lib/useScrollProgress';

/**
 * 상단 고정 바 — 스크롤 연동 베일(반투명 화이트+블러, 하단 CTA의 미러).
 *
 * "상시 켜짐"과 "긴 페이드"는 양립 불가다: 바 안에 가두면 전환이 급해 끊겨 보이고,
 * 밖으로 늘리면 정지 상태에서 아래 콘텐츠가 뿌예진다. 그래서 베일의 불투명도를
 * 스크롤 량에 비례(0→1)시킨다 — 정지 = 완전 투명, 스크롤 = 긴 꼬리(-bottom-12)의
 * 베일이 서서히 차오른다. 토글(갑자기 켜짐)이 아니라 연속 페이드.
 */
export default function FrostedBar({
  children,
  innerClassName = '',
}: {
  children: ReactNode;
  /** 안쪽 컨테이너(페이지 폭 정렬용) 클래스 */
  innerClassName?: string;
}) {
  const p = useScrollProgress();
  return (
    <div className="sticky top-0 z-40">
      <div
        aria-hidden
        style={{ opacity: p }}
        className="pointer-events-none absolute inset-x-0 -bottom-12 top-0 bg-white/60 backdrop-blur-lg [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
      />
      <div className={`relative ${innerClassName}`}>{children}</div>
    </div>
  );
}
