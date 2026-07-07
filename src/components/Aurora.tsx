/**
 * 오로라 배경 — 토스 방식 그대로. radial-gradient 레이어 3~4장을 transform만으로
 * 흘려보낸다(합성 전용 — blur 필터 금지, 그라데이션 falloff가 부드러움을 만든다).
 *
 * 부모는 반드시 `relative overflow-hidden` 이어야 한다. 루트가 inset:-20%로
 * 오버사이즈라 드리프트 중에도 가장자리가 드러나지 않는다.
 * 적용 위치는 3곳뿐: 홈 상단 공기감(home) / 스캔 모먼트(scan) / 완료 화면(done).
 * reduced-motion 시 애니메이션만 멈추고 정적 그라데이션은 유지한다(globals.css).
 */

export type AuroraVariant = 'home' | 'scan' | 'done';

export interface AuroraProps {
  variant?: AuroraVariant;
}

/** 실측 3색 — 하늘 / 복숭아 / 옅은 블루 (+scan 전용 딥 블루 계열) */
const SKY = 'rgba(80,213,255,.25)';
const PEACH = 'rgba(255,220,200,.2)';
const PALE = 'rgba(200,230,255,.2)';
const DEEP = 'rgba(120,144,234,.2)';

interface AuroraLayer {
  /** radial-gradient 한 장 — 큰 타원 + transparent 종단으로 부드러운 falloff */
  background: string;
  /** 레이어 강도 — variant의 성격(은은/깊은/따뜻)을 여기서 조절 */
  opacity: number;
  /** 드리프트 궤적 1~4 (globals.css의 aurora-l*) */
  drift: 1 | 2 | 3 | 4;
}

const glow = (color: string, w: number, h: number, x: number, y: number) =>
  `radial-gradient(${w}% ${h}% at ${x}% ${y}%, ${color}, transparent)`;

/**
 * home = 은은한 블루 공기감(복숭아는 기척만) / scan = 더 깊은 블루 맥락 강조 /
 * done = 가장 따뜻하게(복숭아가 앞으로 나온다).
 */
const LAYERS: Record<AuroraVariant, AuroraLayer[]> = {
  home: [
    { background: glow(SKY, 70, 52, 24, 26), opacity: 0.75, drift: 1 },
    { background: glow(PALE, 80, 62, 78, 20), opacity: 0.9, drift: 2 },
    { background: glow(PEACH, 64, 50, 62, 76), opacity: 0.4, drift: 3 },
  ],
  scan: [
    { background: glow(SKY, 74, 56, 30, 32), opacity: 1, drift: 1 },
    { background: glow(DEEP, 78, 60, 74, 26), opacity: 1, drift: 2 },
    { background: glow(PALE, 84, 64, 50, 82), opacity: 0.9, drift: 3 },
    { background: glow(DEEP, 60, 46, 18, 78), opacity: 0.6, drift: 4 },
  ],
  done: [
    { background: glow(PEACH, 88, 66, 34, 34), opacity: 1, drift: 1 },
    { background: glow(PEACH, 70, 54, 72, 68), opacity: 0.9, drift: 4 },
    { background: glow(SKY, 60, 46, 80, 20), opacity: 0.5, drift: 2 },
    { background: glow('rgba(255,255,187,.22)', 74, 58, 55, 78), opacity: 0.85, drift: 3 },
  ],
};

export default function Aurora({ variant = 'home' }: AuroraProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-[20%]">
      {LAYERS[variant].map((layer, i) => (
        <div
          key={i}
          className={`aurora-layer aurora-l${layer.drift}`}
          style={{ background: layer.background, opacity: layer.opacity }}
        />
      ))}
    </div>
  );
}
