'use client';

import { useId } from 'react';
import type { Person } from '../lib/types';
import { AVATAR_PALETTE, FACES, faceIdByName, type FaceConfig } from '../data/faces';

/**
 * 원형 아바타 — ORG 인물은 플랫 일러스트 얼굴(faces.ts 스펙), 미등록 이름은
 * 이니셜(파스텔 배경 + 깊은 톤 글자) 폴백. onClick이 있으면 .pressable 버튼이 된다.
 *
 * 얼굴 렌더러는 v1 이식: viewBox 0 0 40 40, 원형 클리핑 안 어깨선까지의 흉상 구도.
 * 24px에서도 읽히도록 정체성은 실루엣(헤어 8종)이 지고, 디테일(눈·입·안경)은
 * 극히 얇은 딥톤 라인 하나로만 얹는다. 레이어: 배경 → 포니테일(몸 뒤) → 목 → 상의
 * → 뒷머리(어깨 위) → 귀 → 얼굴 → 앞머리 → 볼터치·표정 → 안경.
 */

// ── 팔레트 (시맨틱 상수) ─────────────────────────────────────────────
/** 웜 라이트 피부 3종 — base 얼굴, shade 목(턱 아래 분리감) */
const SKIN_TONES = [
  { base: '#FFE4CE', shade: '#F1C6A2' }, // 밝은 웜
  { base: '#F8D5B4', shade: '#E6B48B' }, // 중간 웜
  { base: '#F2C9A8', shade: '#DCA87E' }, // 약간 태닝
] as const;

/** 흑발 / 다크브라운 / 밝은 갈색·애쉬 */
const HAIR_COLORS = ['#30323A', '#4E3A2C', '#9A7350'] as const;

/** 상의 — 차분한 뉴트럴 3종 순환 + 이찬 전용 primary 파랑 */
const TOP_COLORS = ['#E5E9EF', '#B9C2CE', '#69758A', '#3182F6'] as const;

const INK = '#453A34'; // 눈·입 딥톤 디테일
const BLUSH = '#F79D8A'; // 볼터치
const FRAME = '#444C59'; // 안경 프레임

// ── 공통 지오메트리 ──────────────────────────────────────────────────
// 얼굴: 타원 (20, 18.6) rx 8.1 ry 8.7 → 정수리 9.9, 턱 27.3
const NECK_D = 'M17.9,23.5 H22.1 V30.2 H17.9 Z';
const TOP_D = 'M9.4,40 V35.6 C9.4,31.5 12.5,29.3 16.1,29.3 H23.9 C27.5,29.3 30.6,31.5 30.6,35.6 V40 Z';
/** 앞머리 캡 공통 바깥 윤곽 — 정수리를 살짝 크게 감싼 뒤 각 스타일의 헤어라인으로 닫는다 */
const CAP = 'M11.5,19.6 C11.5,12 14.6,8.6 20,8.6 C25.4,8.6 28.5,12 28.5,19.6';

// ── 헤어 8종 (한국 오피스 기준) ─────────────────────────────────────
interface HairStyle {
  /** 앞머리/캡 — 얼굴 위 */
  front: string;
  /** 뒷머리 — 어깨(상의) 위, 얼굴 뒤 */
  back?: string;
  /** 몸 뒤로 넘어가는 갈래 (낮은 포니테일) */
  tail?: string;
  /** 귀 노출 여부 (짧은/묶은 머리) */
  ears?: boolean;
}

const HAIR_STYLES: readonly HairStyle[] = [
  // 0 가르마 숏컷 — 오른쪽 22.5에 가르마 노치, 왼쪽으로 쓸어내린 앞머리
  {
    front: `${CAP} C28.2,16 27.1,14.5 24.5,14.2 C23.5,14.1 22.9,13.7 22.5,13 C20.9,14.4 17.4,15.1 14.6,16.1 C13.2,16.9 12,18 11.5,19.6 Z`,
    ears: true,
  },
  // 1 댄디컷 — 눈썹 위에서 고르게 떨어지는 일자 앞머리
  {
    front: `${CAP} C28.4,16.8 27.9,15.1 26.4,14.6 C24.6,14 15.4,14 13.6,14.6 C12.1,15.1 11.6,16.8 11.5,19.6 Z`,
    ears: true,
  },
  // 2 시스루뱅 — 이마가 비치는 얇은 앞머리 두 갈래 + 등까지 곧게 떨어지는 긴 머리
  {
    front: `${CAP} C28.2,14.6 26.6,12.4 24.4,12.2 C23.8,14.6 23,14.6 22.4,12 C21.6,11.9 20.4,11.9 19.6,12 C19,14.4 18.2,14.4 17.6,12.2 C15.4,12.4 13.8,14.6 11.5,19.6 Z`,
    back:
      'M10.9,18.5 C10.9,11 14.8,8.3 20,8.3 C25.2,8.3 29.1,11 29.1,18.5 L29.1,23 L10.9,23 Z ' +
      'M10.9,16 C10.7,21 10.3,27 9.4,31.8 C10.6,33.2 12.6,33.5 14,32.6 C14.3,27.5 14.3,22 14,16.5 Z ' +
      'M29.1,16 C29.3,21 29.7,27 30.6,31.8 C29.4,33.2 27.4,33.5 26,32.6 C25.7,27.5 25.7,22 26,16.5 Z',
  },
  // 3 단발 — 일자 앞머리 + 턱선에서 안으로 말리는 보브
  {
    front:
      'M12.9,17.2 C12.9,11.4 15.8,9.2 20,9.2 C24.2,9.2 27.1,11.4 27.1,17.2 C27.1,14.7 26.3,13.8 24.8,13.6 C21.6,13.2 18.4,13.2 15.2,13.6 C13.7,13.8 12.9,14.7 12.9,17.2 Z',
    back: 'M10.4,18.5 C10.4,10.6 14.6,8 20,8 C25.4,8 29.6,10.6 29.6,18.5 C29.8,23.2 29.4,26.4 28.3,28.4 C27.2,29.8 25.5,29.4 25.1,27.6 C24.9,25 24.9,22.5 25,20 L15,20 C15.1,22.5 15.1,25 14.9,27.6 C14.5,29.4 12.8,29.8 11.7,28.4 C10.6,26.4 10.2,23.2 10.4,18.5 Z',
  },
  // 4 중단발 — 커튼 가르마(이마 노출) + 어깨에 닿는 길이, 끝이 살짝 바깥으로
  {
    front: `${CAP} C27.5,14.6 25.9,11.6 21.5,10.5 C17.5,11.3 13.7,14.2 11.5,19.6 Z`,
    back: 'M10.5,18.5 C10.5,10.6 14.7,8.1 20,8.1 C25.3,8.1 29.5,10.6 29.5,18.5 C29.7,24 29.9,28.3 30.7,31.4 C29.5,32.7 27.6,32.9 26.3,32.1 C25.6,29 25.3,25.5 25.4,21.5 L14.6,21.5 C14.7,25.5 14.4,29 13.7,32.1 C12.4,32.9 10.5,32.7 9.3,31.4 C10.1,28.3 10.3,24 10.5,18.5 Z',
  },
  // 5 낮은 포니테일 — 이마가 드러나게 넘긴 얇은 캡 + 오른쪽 어깨 뒤 갈래
  {
    front: `${CAP} C28,14.2 25.4,11.2 20,11.2 C14.6,11.2 12,14.2 11.5,19.6 Z`,
    tail: 'M26.8,19.5 C29.5,20.6 31.1,23.6 30.9,27.4 C30.8,30.1 29.9,32.2 28.4,33.4 C27.2,31.7 26.4,28.7 26.6,25 C26.7,22.9 26.7,20.9 26.8,19.5 Z',
    ears: true,
  },
  // 6 볼륨 웨이브 — 옆으로 쓸어넘긴 앞머리 + 물결치는 바깥 실루엣의 긴 머리
  {
    front: `${CAP} C27.9,13.4 25.5,11.5 22.5,11.3 C21.1,12.5 18.7,13.1 16.3,12.7 C13.9,13.5 12,15.7 11.5,19.6 Z`,
    back:
      'M10.3,18.5 C10.3,10.4 14.6,7.9 20,7.9 C25.4,7.9 29.7,10.4 29.7,18.5 L29.7,23 L10.3,23 Z ' +
      'M10.3,15.5 C8.9,18.5 9.9,21 8.9,23.8 C7.9,26.7 8.5,29.9 10.3,32.6 C12,34 14.2,34 15.6,32.9 C14.1,30.5 14.5,28.1 15.1,25.6 C15.7,23 14.9,19.4 14.5,15.8 Z ' +
      'M29.7,15.5 C31.1,18.5 30.1,21 31.1,23.8 C32.1,26.7 31.5,29.9 29.7,32.6 C28,34 25.8,34 24.4,32.9 C25.9,30.5 25.5,28.1 24.9,25.6 C24.3,23 25.1,19.4 25.5,15.8 Z',
  },
  // 7 투블럭 — 관자놀이가 드러나는 짧은 옆 + 볼륨 있는 윗머리
  {
    front:
      'M13.2,15.8 C12.6,10.6 15.7,8.2 20,8.2 C24.3,8.2 27.4,10.6 26.8,15.8 C26.7,14.1 25.9,13.3 24.4,13 C21.5,12.5 18.5,12.5 15.6,13 C14.1,13.3 13.3,14.1 13.2,15.8 Z',
    ears: true,
  },
];

// ── 파츠 렌더러 ──────────────────────────────────────────────────────
const EYE_L = { x: 16.9, y: 18.4 };
const EYE_R = { x: 23.1, y: 18.4 };

/** 표정 3종 — 0 미소(점 눈+곡선 입), 1 활짝(눈웃음+열린 입), 2 차분(점 눈+잔잔한 입) */
function Expression({ kind }: { kind: 0 | 1 | 2 }) {
  const eyes =
    kind === 1 ? (
      <>
        <path d="M15.5,18.8 Q16.9,17.2 18.3,18.8" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        <path d="M21.7,18.8 Q23.1,17.2 24.5,18.8" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx={EYE_L.x} cy={EYE_L.y} r={1} fill={INK} />
        <circle cx={EYE_R.x} cy={EYE_R.y} r={1} fill={INK} />
      </>
    );
  const mouth =
    kind === 0 ? (
      <path d="M18.1,22.2 Q20,23.9 21.9,22.2" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
    ) : kind === 1 ? (
      <path d="M17.6,21.7 H22.4 A2.4,2.4 0 0 1 17.6,21.7 Z" fill="#5B3E38" />
    ) : (
      <path d="M18.5,22.5 Q20,23.1 21.5,22.5" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
    );
  return (
    <>
      {eyes}
      {mouth}
    </>
  );
}

/** 얇은 라운드 프레임 안경 — 극히 얇은 딥톤 라인 */
function Glasses() {
  return (
    <g fill="none" stroke={FRAME} strokeWidth={0.9}>
      <circle cx={EYE_L.x} cy={EYE_L.y} r={2.8} />
      <circle cx={EYE_R.x} cy={EYE_R.y} r={2.8} />
      <path d="M19.7,18 Q20,17.6 20.3,18" strokeLinecap="round" />
    </g>
  );
}

/** 플랫 일러스트 얼굴 — 정적 SVG (모션 없음) */
function AvatarFace({ config, size }: { config: FaceConfig; size: number }) {
  // useId의 구분 문자(«», :)는 url(#…) 프래그먼트에서 브라우저별로 취약 — 영숫자만 남긴다
  const clipId = `face-clip-${useId().replace(/\W/g, '')}`;
  const skin = SKIN_TONES[config.skin];
  const hairFill = HAIR_COLORS[config.hairColor];
  const hair = HAIR_STYLES[config.hair];
  const top = TOP_COLORS[config.top ?? config.bg % 3];
  const bg = AVATAR_PALETTE[config.bg % AVATAR_PALETTE.length].bg;

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx={20} cy={20} r={20} />
        </clipPath>
      </defs>
      <circle cx={20} cy={20} r={20} fill={bg} />
      <g clipPath={`url(#${clipId})`}>
        {hair.tail && <path d={hair.tail} fill={hairFill} />}
        <path d={NECK_D} fill={skin.shade} />
        <path d={TOP_D} fill={top} />
        {hair.back && <path d={hair.back} fill={hairFill} />}
        {hair.ears && (
          <>
            <ellipse cx={11.3} cy={19.8} rx={1.4} ry={1.6} fill={skin.base} />
            <ellipse cx={28.7} cy={19.8} rx={1.4} ry={1.6} fill={skin.base} />
          </>
        )}
        <ellipse cx={20} cy={18.6} rx={8.1} ry={8.7} fill={skin.base} />
        <path d={hair.front} fill={hairFill} />
        <ellipse cx={14.7} cy={21.6} rx={1.5} ry={0.95} fill={BLUSH} opacity={0.5} />
        <ellipse cx={25.3} cy={21.6} rx={1.5} ry={0.95} fill={BLUSH} opacity={0.5} />
        <Expression kind={config.expression} />
        {config.accessory === 'glasses' && <Glasses />}
      </g>
    </svg>
  );
}

// ── 이니셜 폴백 ──────────────────────────────────────────────────────
/**
 * 이름 → 팔레트 인덱스. 곱셈 해시 뒤 xor-shift로 섞는다 — 같은 이름은 항상 같은 색.
 * FACES에 없는 인물에만 쓰인다. ORG 20명은 faces.ts에서 bg를 고정 지정.
 */
function paletteIndex(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 162 + (ch.codePointAt(0) ?? 0)) >>> 0;
  h = (h ^ (h >>> 9)) >>> 0;
  return h % AVATAR_PALETTE.length;
}

/** '이서연' → '서', '이찬' → '찬' — 성을 뗀 첫 음절. 한 글자 이름은 그대로 쓴다. */
function initialOf(name: string): string {
  const chars = [...name.trim()];
  return chars.length > 1 ? chars[1] : (chars[0] ?? '');
}

// ── 본체 ────────────────────────────────────────────────────────────
export type AvatarSize = 24 | 32 | 40;

export interface AvatarProps {
  /** ORG 인물 — 주면 faceId·name을 여기서 읽는다 */
  person?: Pick<Person, 'name' | 'faceId'>;
  /** person 없이 직접 지정할 때 */
  faceId?: string;
  name?: string;
  size?: AvatarSize;
  onClick?: () => void;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  24: 'h-6 w-6 text-[10px]',
  32: 'h-8 w-8 text-[12px]',
  40: 'h-10 w-10 text-[14px]',
};

export default function Avatar({ person, faceId, name, size = 40, onClick }: AvatarProps) {
  const displayName = person?.name ?? name ?? '';
  const face = FACES[person?.faceId ?? faceId ?? faceIdByName(displayName) ?? ''];
  const color = face
    ? AVATAR_PALETTE[face.bg % AVATAR_PALETTE.length]
    : AVATAR_PALETTE[paletteIndex(displayName)];

  const className = `relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold ${SIZE_CLASS[size]}`;
  const style = { backgroundColor: color.bg, color: color.text };
  const content = face ? <AvatarFace config={face} size={size} /> : initialOf(displayName);

  if (onClick) {
    return (
      <button type="button" aria-label={displayName} onClick={onClick} className={`pressable ${className}`} style={style}>
        {content}
      </button>
    );
  }
  return (
    <span role="img" aria-label={displayName} className={className} style={style}>
      {content}
    </span>
  );
}
