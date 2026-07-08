'use client';

import { useEffect, useState } from 'react';

/** 창 스크롤이 threshold를 넘으면 true — 상단 바의 frosted(반투명+블러) 전환 신호. */
export default function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}
