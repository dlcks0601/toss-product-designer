/**
 * 스캔 모먼트 타이밍·카피 — 순수 헬퍼. ScanMoment(연출)와 테스트가 같은 소스를 읽는다.
 *
 * 시퀀스(해외송금 진행 화면의 문법): 세로 3스텝 타임라인을 빛이 타고 내려간다 —
 * 스텝마다 도트 점등 + 시머 타이틀 + 설명 한 줄, 지나간 레일은 파랑 필로 차오른다.
 * 설명 자리는 상시 확보되어 레일 길이는 변하지 않는다(빛이 같은 길이를 이동).
 * 마지막 스텝 뒤 헤드라인이 '모두 가능한 N을 찾았어요'로 바뀌고 한 박자 쉰 뒤 onDone.
 * 카피 계약: 기능 서술만, 담백하게 — '모두를 생각한' 류의 수사는 쓰지 않는다.
 */

/** 스텝 하나가 활성인 시간(ms) — 설명 한 줄이 읽히는 호흡. 레일 필도 이 박자로 차오른다. */
export const SCAN_STEP_MS = 1900;
/** 마무리 헤드라인('찾았어요')이 읽히는 비트(ms) — 이후 onDone. */
export const SCAN_FINALE_MS = 1300;

export interface ScanStep {
  /** 스텝 제목 — 활성 구간엔 시머 그라데이션으로 켜진다 */
  title: string;
  /** 활성 구간에만 보이는 설명 한 줄(자리는 상시 확보) */
  desc: string;
}

/** 3스텝 고정 카피 — 첫 스텝만 인원수를 싣는다(엔진이 실제로 하는 일의 순서). */
export function scanSteps(attendeeCount: number): ScanStep[] {
  return [
    { title: '캘린더 읽는 중', desc: `${attendeeCount}명의 다음 주를 펼쳐 보고 있어요` },
    { title: '바쁜 시간 피하는 중', desc: '점심 리듬과 외근, 휴가까지 살펴요' },
    { title: '좋은 시간 고르는 중', desc: '모두에게 편한 순서로 줄을 세워요' },
  ];
}

/** 마무리 문장 — 회의 길이에 맞춘다(기본 여정 60분 = '1시간'). 세 라벨 모두 받침 ㄴ이라 '을' 고정. */
export function finalScanLine(duration: 30 | 60 | 90): string {
  const label = duration === 30 ? '30분' : duration === 60 ? '1시간' : '1시간 30분';
  return `모두 가능한 ${label}을 찾았어요`;
}

export interface ScanTimeline {
  /** i번째 스텝이 활성화되는 시각(ms, 마운트 기준) — 첫 스텝은 0 */
  stepAt: number[];
  /** 헤드라인이 마무리 문장으로 바뀌는 시각 — 마지막 스텝이 끝나는 순간 */
  finaleAt: number;
  /** onDone 호출 시각 — 3스텝 기준 3×1900+1300 = 7.0s */
  doneAt: number;
}

/** 스텝 수 → 전체 타임라인. */
export function scanTimeline(stepCount: number): ScanTimeline {
  const stepAt = Array.from({ length: stepCount }, (_, i) => i * SCAN_STEP_MS);
  const finaleAt = stepCount * SCAN_STEP_MS;
  return { stepAt, finaleAt, doneAt: finaleAt + SCAN_FINALE_MS };
}
