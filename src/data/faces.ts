import { ORG } from './world';

/**
 * 인물별 얼굴 조합 정의 — 20명 전원 손 큐레이션(랜덤·해시 금지). v1 이식.
 *
 * 큐레이션 규칙:
 * - (hair, hairColor, skin, accessory, bg) 완전 중복 조합 금지 — faces.test.ts 가 계약을 지킨다.
 * - 밝은 염색(hairColor 2)은 2~3명만 (정하늘·신예린·박소율) — 한국 오피스 비율.
 * - 안경은 4~5명 (박준호·이서연·임가온·이한결·최온유).
 * - 이찬(나)만 top 3 = primary 파랑 상의로 은근히 구분.
 */

export interface FaceConfig {
  /** 웜 라이트 3종 — 0 밝은, 1 중간, 2 약간 태닝 */
  skin: 0 | 1 | 2;
  /** 0 가르마 숏컷 · 1 댄디컷 · 2 시스루뱅 · 3 단발 · 4 중단발 · 5 낮은 포니테일 · 6 볼륨 웨이브 · 7 투블럭 */
  hair: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** 0 흑발 · 1 다크브라운 · 2 밝은 갈색/애쉬 (20명 중 2~3명만) */
  hairColor: 0 | 1 | 2;
  /** 0 미소 · 1 활짝(눈웃음) · 2 차분 */
  expression: 0 | 1 | 2;
  accessory?: 'glasses';
  /** AVATAR_PALETTE 인덱스 — 해시 대신 고정 지정 */
  bg: number;
  /** 상의 색 — 0~2 뉴트럴 순환(생략 시 bg % 3), 3은 primary 파랑(이찬 전용) */
  top?: 0 | 1 | 2 | 3;
}

/**
 * 인물별 고정 파스텔 팔레트 — 연한 배경 + 같은 계열의 깊은 글자색 6쌍.
 * (Avatar 이니셜 폴백과 AvatarFace 원형 배경이 공유하는 단일 소스)
 */
export const AVATAR_PALETTE = [
  { bg: '#E8F3EC', text: '#1B8A5A' }, // 초록
  { bg: '#F1EBFE', text: '#7048C8' }, // 보라
  { bg: '#E3F3F8', text: '#0E7490' }, // 청록
  { bg: '#FFF0DC', text: '#B96A0B' }, // 호박
  { bg: '#E0EDFF', text: '#2A6AD4' }, // 파랑
  { bg: '#FDEBF0', text: '#C0447C' }, // 분홍
] as const;

export const FACES: Record<string, FaceConfig> = {
  // ── CORE 6 — 데모 화면에 상시 노출되는 얼굴들 ──
  ichan: { skin: 1, hair: 0, hairColor: 0, expression: 0, bg: 4, top: 3 }, // 나 — 가르마 숏컷·흑발·미소·파랑 상의
  junho: { skin: 0, hair: 7, hairColor: 0, expression: 2, accessory: 'glasses', bg: 2 }, // FE — 투블럭·안경·차분
  seoyeon: { skin: 0, hair: 3, hairColor: 0, expression: 0, accessory: 'glasses', bg: 1 }, // Data — 단발·안경·미소
  minsu: { skin: 1, hair: 1, hairColor: 1, expression: 1, bg: 3 }, // Design — 댄디컷·다크브라운·활짝
  haneul: { skin: 0, hair: 4, hairColor: 2, expression: 1, bg: 5 }, // Marketing — 중단발·애쉬 염색·활짝
  sehun: { skin: 2, hair: 0, hairColor: 1, expression: 2, bg: 0 }, // BE — 가르마·다크브라운·차분

  // ── EXTRA 14 — 그리드에서 옆자리와 실루엣이 겹치지 않게 배치 ──
  sujin: { skin: 1, hair: 3, hairColor: 1, expression: 2, bg: 2 }, // QA — 단발·다크브라운
  doyun: { skin: 1, hair: 7, hairColor: 1, expression: 0, bg: 0 }, // iOS — 투블럭·다크브라운
  saebom: { skin: 0, hair: 2, hairColor: 0, expression: 0, bg: 3 }, // UX Writer — 시스루뱅·흑발
  yeonghun: { skin: 2, hair: 1, hairColor: 0, expression: 2, bg: 4 }, // Server — 댄디컷·흑발
  gaon: { skin: 1, hair: 4, hairColor: 0, expression: 2, accessory: 'glasses', bg: 2 }, // Brand — 중단발·안경
  jiwoo: { skin: 1, hair: 5, hairColor: 0, expression: 1, bg: 0 }, // Sales — 낮은 포니테일·활짝
  yerin: { skin: 0, hair: 2, hairColor: 2, expression: 0, bg: 1 }, // PM — 시스루뱅·애쉬 염색
  taeyang: { skin: 0, hair: 0, hairColor: 0, expression: 1, bg: 5 }, // Android — 가르마·활짝
  bada: { skin: 2, hair: 7, hairColor: 0, expression: 1, bg: 3 }, // BD — 투블럭·태닝 톤
  hangyeol: { skin: 1, hair: 1, hairColor: 0, expression: 0, accessory: 'glasses', bg: 5 }, // Data Eng — 댄디컷·안경
  soyul: { skin: 0, hair: 6, hairColor: 2, expression: 0, bg: 4 }, // Content — 볼륨 웨이브·밝은 갈색
  onyu: { skin: 1, hair: 2, hairColor: 1, expression: 2, accessory: 'glasses', bg: 0 }, // Legal — 시스루뱅·안경·차분
  daon: { skin: 2, hair: 6, hairColor: 1, expression: 1, bg: 1 }, // CX — 볼륨 웨이브·다크브라운
  eunchae: { skin: 2, hair: 3, hairColor: 0, expression: 1, bg: 3 }, // Finance — 단발·활짝
};

/** 이름 → id 조회 (ORG 이름은 전원 고유). Avatar 가 name 만 받아도 얼굴을 찾도록 하는 다리. */
const NAME_TO_ID = new Map(ORG.map((m) => [m.name, m.id]));

export function faceIdByName(name: string): string | undefined {
  return NAME_TO_ID.get(name.trim());
}
