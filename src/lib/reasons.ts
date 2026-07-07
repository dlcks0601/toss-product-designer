import type { Attendee, ReasonCode, ReasonTone, ScoreEffect, SlotReason } from './types';
import { fmtTime } from './time';

/** 완성형 한글 음절의 받침 유무. 한글 음절이 아니면 받침 없음으로 취급. */
function hasBatchim(char: string): boolean {
  const code = (char ?? '').charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

/** 한글 조사 선택: 받침이 있으면 withBatchim, 없으면 withoutBatchim. (예: josa('지은','이','가')→'이') */
export function josa(name: string, withBatchim: string, withoutBatchim: string): string {
  const last = name.length > 0 ? name[name.length - 1] : '';
  return hasBatchim(last) ? withBatchim : withoutBatchim;
}

/** 코드→톤 매핑(결함⑩·severity 근거). */
const TONE: Record<ReasonCode, ReasonTone> = {
  'all-required-ok': 'positive',
  'optional-ok': 'positive',
  'before-lunch-bonus': 'positive',
  'optional-partial': 'tradeoff',
  'optional-unavailable': 'tradeoff',
  'back-to-back': 'tradeoff',
  'focus-overlap': 'tradeoff',
  'late-start': 'tradeoff',
  'after-lunch': 'warning',
  'lunch-squeeze': 'warning',
  'offsite-day': 'warning',
  'no-room': 'warning',
};

const REQUIRED_OK_LINE = (n: number) => `필수 ${n}명 모두 편하게 참석할 수 있어요`;

/** 한 effect를 해요체 문장으로. 감정어 금지. 매핑 없는 코드(Task 5·6 예약)는 null → 스킵. */
function reasonText(effect: ScoreEffect, nameOf: (id?: string) => string, requiredCount: number): string | null {
  const who = effect.who;
  switch (effect.code) {
    case 'all-required-ok':
      return REQUIRED_OK_LINE(requiredCount);
    case 'optional-ok': {
      const ok = Number(effect.data?.ok ?? 0);
      const total = Number(effect.data?.total ?? 0);
      return `선택 참석자 ${total}명 중 ${ok}명이 함께할 수 있어요`;
    }
    case 'optional-partial': {
      const part = effect.data?.part === 'back' ? '뒤' : '앞';
      const minutes = Number(effect.data?.minutes ?? 0);
      const title = String(effect.data?.title ?? '');
      return `${nameOf(who)}님은 ${part} ${minutes}분만 함께할 수 있어요 — ${title}`;
    }
    case 'optional-unavailable':
      return `${nameOf(who)}님은 이 시간이 어려워요`;
    case 'offsite-day':
      return `${nameOf(who)}님 외근 날이에요 — 화상으로 합류할 수 있어요`;
    case 'back-to-back': {
      const side = effect.data?.side === 'before' ? '직전' : '직후';
      return `${nameOf(who)}님은 ${side}에 다른 일정이 있어요`;
    }
    case 'focus-overlap':
      return `${nameOf(who)}님의 집중 시간과 겹쳐요`;
    case 'late-start':
      return '하루가 끝나갈 무렵이에요';
    case 'no-room':
      return '비어 있는 회의실이 없어요 — 화상은 가능해요';
    case 'after-lunch':
      return `${nameOf(who)}님은 보통 ${fmtTime(Number(effect.data?.rhythmStart ?? 0))}쯤 점심을 먹어요 — 직후 시작은 나른할 수 있어요`;
    case 'before-lunch-bonus':
      return '점심 직전이라 산뜻하게 끝나요';
    case 'lunch-squeeze':
      return `${nameOf(who)}님 점심 여유가 ${Number(effect.data?.gap ?? 0)}분뿐이에요`;
    default:
      return null; // 매핑 없는 코드는 침묵
  }
}

export function formatReasons(effects: ScoreEffect[], attendees: Attendee[]): SlotReason[] {
  const requiredCount = attendees.filter((a) => a.attendanceType === 'required').length;
  const nameById = new Map(attendees.map((a) => [a.id, a.name]));
  const nameOf = (id?: string) => (id ? nameById.get(id) ?? id : '');

  const reasons: SlotReason[] = [];
  for (const effect of effects) {
    const text = reasonText(effect, nameOf, requiredCount);
    if (text === null) continue;
    reasons.push({ code: effect.code, tone: TONE[effect.code], text, who: effect.who });
  }
  return reasons;
}

/** 카드 1줄 요약: 첫 positive + 첫 non-positive를 " · "로 잇는다(없으면 positive만). */
export function summarizeSlot(reasons: SlotReason[], requiredCount: number): string {
  const positive = reasons.find((r) => r.tone === 'positive')?.text ?? REQUIRED_OK_LINE(requiredCount);
  const nonPositive = reasons.find((r) => r.tone !== 'positive')?.text;
  return nonPositive ? `${positive} · ${nonPositive}` : positive;
}

/** 결함⑩: warning 하나라도 있으면 warning, 없고 tradeoff 있으면 tradeoff, 아니면 good. */
export function slotSeverity(reasons: SlotReason[]): 'good' | 'tradeoff' | 'warning' {
  if (reasons.some((r) => r.tone === 'warning')) return 'warning';
  if (reasons.some((r) => r.tone === 'tradeoff')) return 'tradeoff';
  return 'good';
}
