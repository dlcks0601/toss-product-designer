/**
 * 미니 주간 로케이터 — 5칸(월~금) 스트립에 "이 후보가 주간의 어디쯤인지"를 점 하나로 찍는다.
 * 기한 창이 여러 주면(다음 주까지·여유) 스트립을 늘리는 대신 주차 라벨('다음 주')을 붙인다 —
 * 카드 안에서는 한 줄이 정보 밀도의 상한이다.
 *
 * 점의 가로 위치는 시각을 반영한다: 칸 안에서 왼쪽=아침, 오른쪽=저녁(9~18시 프레임).
 * 주(週) 계산 헬퍼는 순수 함수로 노출한다 — CandidateGrid의 주 전환이 같은 수학을 쓴다.
 */
import { addDaysISO, weekdayIndex, type Minutes } from '../lib/time';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'] as const;
/** 점 가로 위치의 기준 프레임 — 9:00~18:00 (그리드와 동일). */
const FRAME_START = 540;
const FRAME_END = 1080;

/** ISO 날짜가 속한 주의 월요일. */
export function mondayOf(isoDate: string): string {
  return addDaysISO(isoDate, -weekdayIndex(isoDate));
}

/** 기한 창이 걸치는 주들의 월요일(정렬·중복 제거). windowFor 출력은 이미 오름차순이다. */
export function weekMondays(windowDays: string[]): string[] {
  const mondays: string[] = [];
  for (const day of windowDays) {
    const monday = mondayOf(day);
    if (mondays[mondays.length - 1] !== monday) mondays.push(monday);
  }
  return mondays;
}

/** day가 기한 창의 몇 번째 주인지(0부터). 창 밖 주면 -1. */
export function weekIndexOf(day: string, windowDays: string[]): number {
  return weekMondays(windowDays).indexOf(mondayOf(day));
}

/** 주차 라벨 — 앵커(오늘)가 속한 주가 0이다. 데모 창은 최대 3주. */
export function weekLabel(index: number): string {
  if (index === 0) return '이번 주';
  if (index === 1) return '다음 주';
  if (index === 2) return '그다음 주';
  return `${index + 1}주 차`;
}

/** 시각 → 칸 안 점의 가로 위치(%). 프레임 밖은 클램프, 여백을 위해 12~88%로 눌러 담는다. */
export function dotXPct(start: Minutes): number {
  const clamped = Math.min(Math.max(start, FRAME_START), FRAME_END);
  const ratio = (clamped - FRAME_START) / (FRAME_END - FRAME_START);
  return 12 + ratio * 76;
}

export interface MiniLocatorProps {
  /** 후보 날짜(ISO) */
  day: string;
  /** 후보 시작 시각(분) — 점의 가로 위치 */
  start: Minutes;
  /** 기한 창 — 주차 라벨 계산에 쓴다 */
  windowDays: string[];
}

export default function MiniLocator({ day, start, windowDays }: MiniLocatorProps) {
  const weekday = weekdayIndex(day); // 0=월..4=금 (엔진이 주말 슬롯을 만들지 않는다)
  const weekIdx = weekIndexOf(day, windowDays);
  const multiWeek = weekMondays(windowDays).length > 1;
  const label = weekLabel(Math.max(weekIdx, 0));

  return (
    <span
      role="img"
      aria-label={`${label} ${WEEKDAY_LABELS[weekday] ?? ''}요일`}
      className="inline-flex items-center gap-2"
    >
      {multiWeek && <span className="text-[11px] font-medium text-text-weak">{label}</span>}
      <span className="inline-flex gap-[3px]">
        {WEEKDAY_LABELS.map((wd, i) => {
          const active = i === weekday;
          return (
            <span
              key={wd}
              className={`relative inline-flex h-[18px] w-[22px] items-center justify-center rounded-[5px] text-[9.5px] leading-none ${
                active ? 'bg-primary-tint font-semibold text-primary' : 'bg-section text-text-faint'
              }`}
            >
              {wd}
              {active && (
                <span
                  aria-hidden
                  className="absolute bottom-[2px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary"
                  style={{ left: `${dotXPct(start)}%` }}
                />
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}
