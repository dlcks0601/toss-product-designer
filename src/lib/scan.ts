/**
 * 스캔 모먼트 타이밍·시퀀스 — 순수 헬퍼. ScanMoment(연출)와 테스트가 같은 소스를 읽는다.
 *
 * 시퀀스: 카드 정착(START) → 아바타 순차 점등(interval × N, scanLine 동기 교체)
 *        → 한 박자(interval) 뒤 마무리 문장 → HOLD 후 onDone.
 * 간격은 점등 예산(~1.2s)을 인원수로 나눠 정하되 120~200ms로 클램프한다 —
 * 6인 이하는 200ms의 리듬, 많아지면 촘촘해지고 문장은 앞 5명 + 요약 한 줄로 압축된다.
 * 문장은 반드시 insights의 실출력(scanLine)이다 — 하드코딩 금지 계약.
 */
import type { PersonInsights } from './types';

/** 카드 정착 후 첫 점등까지(ms). */
export const SCAN_START_MS = 120;
/** 점등 시퀀스 총 예산(ms) — 간격 = 예산/인원, 클램프 전 기준. */
export const SCAN_BUDGET_MS = 1200;
export const SCAN_MAX_INTERVAL_MS = 200;
export const SCAN_MIN_INTERVAL_MS = 120;
/** 마무리 문장 노출 후 onDone까지(ms) — 마지막 문장이 읽히는 한 박자. */
export const SCAN_HOLD_MS = 450;

/** 문장을 개별로 보여줄 최대 인원 — 초과분은 요약 한 줄로 접는다. */
const MAX_INDIVIDUAL_LINES = 5;
/** 이 인원(기본 캐스트 6명)까지는 전원 개별 문장. 초과 시 압축 발동. */
const COMPRESS_ABOVE = 6;

/** 인원수 → 점등 간격(ms). 예산/인원을 120~200으로 클램프. */
export function scanIntervalMs(count: number): number {
  if (count <= 0) return SCAN_MAX_INTERVAL_MS;
  return Math.max(
    SCAN_MIN_INTERVAL_MS,
    Math.min(SCAN_MAX_INTERVAL_MS, Math.round(SCAN_BUDGET_MS / count)),
  );
}

export interface ScanStep {
  /** 이 스텝에 점등되는 참석자 id */
  id: string;
  /** 점등과 동기화되어 표시되는 문장 — insights[id].scanLine 또는 요약 */
  line: string;
}

/**
 * 참석자 순서 그대로 스텝을 만든다. 6인 초과면 6번째부터의 문장은
 * '나머지 N명의 일정도 확인했어요'로 압축된다(아바타는 전원 점등).
 */
export function buildScanSteps(
  attendees: { id: string }[],
  insights: Record<string, PersonInsights>,
): ScanStep[] {
  const compress = attendees.length > COMPRESS_ABOVE;
  const summary = `나머지 ${attendees.length - MAX_INDIVIDUAL_LINES}명의 일정도 확인했어요`;
  return attendees.map((a, i) => ({
    id: a.id,
    line: compress && i >= MAX_INDIVIDUAL_LINES ? summary : (insights[a.id]?.scanLine ?? ''),
  }));
}

/** 마무리 문장 — 회의 길이에 맞춘다(기본 여정 60분 = '1시간'). 세 라벨 모두 받침 ㄴ이라 '을' 고정. */
export function finalScanLine(duration: 30 | 60 | 90): string {
  const label = duration === 30 ? '30분' : duration === 60 ? '1시간' : '1시간 30분';
  return `모두를 생각한 ${label}을 찾았어요`;
}

export interface ScanTimeline {
  /** 점등 간격(ms) — 진행 바 트랜지션도 이 박자를 탄다 */
  intervalMs: number;
  /** i번째 아바타 점등 시각(ms, 마운트 기준) */
  lightAt: number[];
  /** 마무리 문장으로 교체되는 시각 — 마지막 점등에서 한 박자 뒤 */
  finaleAt: number;
  /** onDone 호출 시각 */
  doneAt: number;
}

/** 인원수 → 전체 타임라인. 기본 캐스트 6인 기준 doneAt ≈ 1.77s (허용 창 1.2~1.8s). */
export function scanTimeline(count: number): ScanTimeline {
  const intervalMs = scanIntervalMs(count);
  const lightAt = Array.from({ length: count }, (_, i) => SCAN_START_MS + i * intervalMs);
  const finaleAt = SCAN_START_MS + count * intervalMs;
  return { intervalMs, lightAt, finaleAt, doneAt: finaleAt + SCAN_HOLD_MS };
}
