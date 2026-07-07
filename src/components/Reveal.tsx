import type { CSSProperties, ReactNode } from 'react';

/**
 * 리빌 래퍼 — 마운트 시 `opacity 0 + blur(12px) + translateY(24px)`에서
 * 800ms(페이드)/900ms(상승·선명) expo-out으로 등장한다(globals.css `.reveal`).
 *
 * 화면이 짧아 IntersectionObserver는 쓰지 않는다 — 스태거는 부모가 delay를
 * 60~80ms 간격으로 지정한다. key를 바꿔 리마운트하면 다시 재생된다.
 * reduced-motion 시 즉시 표시(globals.css에서 animation: none).
 */

export interface RevealProps {
  /** 스태거 지연(ms) — 형제 간 60~80ms 간격 권장 */
  delay?: number;
  as?: 'div' | 'section' | 'span' | 'li' | 'p' | 'header' | 'article';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function Reveal({ delay = 0, as: Tag = 'div', className, style, children }: RevealProps) {
  return (
    <Tag
      className={className ? `reveal ${className}` : 'reveal'}
      style={delay > 0 ? { ...style, animationDelay: `${delay}ms` } : style}
    >
      {children}
    </Tag>
  );
}
