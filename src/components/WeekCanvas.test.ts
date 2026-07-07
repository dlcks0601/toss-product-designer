import { describe, expect, it } from 'vitest';
import {
  CANVAS_BIN_COUNT,
  CANVAS_END,
  CANVAS_START,
  busyCountAt,
  busyLabel,
  busyPeopleAt,
  canvasYPct,
  cycleSlot,
  densityAlpha,
} from './WeekCanvas';
import type { Attendee, CalendarEvent, EventKind } from '../lib/types';

function person(id: string, events: CalendarEvent[]): Attendee {
  return {
    id,
    name: id,
    role: 'test',
    faceId: id,
    workHours: { start: 540, end: 1080 },
    events,
    attendanceType: 'required',
  };
}

function ev(day: string, start: number, end: number, kind: EventKind): CalendarEvent {
  return { id: `${day}-${start}-${kind}`, day, start, end, title: kind, kind };
}

const DAY = '2026-07-15';

describe('busyPeopleAt / busyCountAt', () => {
  it('30분 칸과 겹치는 하드 블로커의 주인 이름을 참석자 순서대로 센다', () => {
    const a = person('a', [ev(DAY, 600, 660, 'meeting')]); // 10:00–11:00
    const b = person('b', [ev(DAY, 630, 690, 'meeting')]); // 10:30–11:30
    expect(busyPeopleAt([a, b], DAY, 600)).toEqual(['a']); // 10:00–10:30
    expect(busyPeopleAt([a, b], DAY, 630)).toEqual(['a', 'b']); // 10:30–11:00
    expect(busyCountAt([a, b], DAY, 660)).toBe(1); // 11:00–11:30 — b만
    expect(busyCountAt([a, b], DAY, 690)).toBe(0);
  });

  it('lunch·focus는 세지 않는다(soft) — 밀도는 "진짜 안 되는 사람 수"다', () => {
    const a = person('a', [
      ev(DAY, 720, 780, 'lunch'),
      ev(DAY, 540, 600, 'focus'),
      ev(DAY, 900, 960, 'offsite'),
      ev(DAY, 990, 1020, 'personal'),
    ]);
    expect(busyCountAt([a], DAY, 720)).toBe(0); // lunch 제외
    expect(busyCountAt([a], DAY, 540)).toBe(0); // focus 제외
    expect(busyCountAt([a], DAY, 900)).toBe(1); // offsite 포함
    expect(busyCountAt([a], DAY, 990)).toBe(1); // personal 포함
  });

  it('다른 날 일정과 경계가 맞닿기만 하는 일정은 무시한다', () => {
    const a = person('a', [ev('2026-07-16', 600, 660, 'meeting'), ev(DAY, 660, 690, 'meeting')]);
    expect(busyCountAt([a], DAY, 600)).toBe(0); // 다른 날 + 경계 접촉(630~660 vs 660~690)
    expect(busyCountAt([a], DAY, 630)).toBe(0);
    expect(busyCountAt([a], DAY, 660)).toBe(1);
  });

  it('한 사람이 같은 칸에 겹치는 일정이 여럿이어도 1명으로 센다', () => {
    const a = person('a', [ev(DAY, 600, 660, 'meeting'), ev(DAY, 630, 700, 'personal')]);
    expect(busyCountAt([a], DAY, 630)).toBe(1);
  });
});

describe('busyLabel', () => {
  it('3명 이하는 전원 이름을 적는다', () => {
    expect(busyLabel(['박준호'])).toBe('바쁜 사람 1명 — 박준호');
    expect(busyLabel(['박준호', '이서연', '정하늘'])).toBe('바쁜 사람 3명 — 박준호, 이서연, 정하늘');
  });

  it('4명부터는 3명 + 외 N', () => {
    expect(busyLabel(['a', 'b', 'c', 'd', 'e'])).toBe('바쁜 사람 5명 — a, b, c 외 2');
  });
});

describe('densityAlpha', () => {
  it('0명은 투명, 전원이면 최대 농도(≈0.49)', () => {
    expect(densityAlpha(0, 6)).toBe(0);
    expect(densityAlpha(6, 6)).toBeCloseTo(0.49, 2);
  });

  it('사람 수에 단조 증가하고 총원 초과는 클램프한다', () => {
    const steps = [1, 2, 3, 4, 5, 6].map((c) => densityAlpha(c, 6));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(densityAlpha(9, 6)).toBe(densityAlpha(6, 6));
    expect(densityAlpha(1, 0)).toBe(0);
  });
});

describe('canvasYPct', () => {
  it('프레임(9~19시)을 0~100%로 사상하고 밖은 클램프한다', () => {
    expect(canvasYPct(CANVAS_START)).toBe(0);
    expect(canvasYPct(CANVAS_END)).toBe(100);
    expect(canvasYPct(840)).toBe(50); // 14:00 — 9~19시의 정중앙
    expect(canvasYPct(0)).toBe(0);
    expect(canvasYPct(1440)).toBe(100);
  });

  it('30분 칸은 20개다', () => {
    expect(CANVAS_BIN_COUNT).toBe(20);
  });
});

describe('cycleSlot — 키보드 ←→ 순회', () => {
  const ids = ['s1', 's2', 's3'];

  it('빈 목록이면 null', () => {
    expect(cycleSlot([], null, 1)).toBeNull();
    expect(cycleSlot([], 's1', -1)).toBeNull();
  });

  it('선택이 없으면 →는 첫 후보, ←는 마지막 후보', () => {
    expect(cycleSlot(ids, null, 1)).toBe('s1');
    expect(cycleSlot(ids, null, -1)).toBe('s3');
  });

  it('목록 밖 id(낡은 선택)도 처음/끝에서 다시 시작한다', () => {
    expect(cycleSlot(ids, 'gone', 1)).toBe('s1');
    expect(cycleSlot(ids, 'gone', -1)).toBe('s3');
  });

  it('양방향 순환 — 끝에서 처음으로, 처음에서 끝으로 감싼다', () => {
    expect(cycleSlot(ids, 's1', 1)).toBe('s2');
    expect(cycleSlot(ids, 's3', 1)).toBe('s1');
    expect(cycleSlot(ids, 's2', -1)).toBe('s1');
    expect(cycleSlot(ids, 's1', -1)).toBe('s3');
  });

  it('후보가 하나면 자기 자신으로 돈다', () => {
    expect(cycleSlot(['only'], 'only', 1)).toBe('only');
    expect(cycleSlot(['only'], 'only', -1)).toBe('only');
  });
});
