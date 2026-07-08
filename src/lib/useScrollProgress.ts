'use client';

import { useEffect, useState } from 'react';

/** 창 스크롤 0→range(px)를 0→1로 — frost가 토글이 아니라 비례로 차오르게 한다. */
export default function useScrollProgress(range = 72): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => setP(Math.min(1, Math.max(0, window.scrollY / range)));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [range]);
  return p;
}
