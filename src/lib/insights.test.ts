import { describe, it, expect } from 'vitest';
import { deriveInsights, deriveAllInsights } from './insights';
import { scoreSlot } from './scoring';
import type { CalendarEvent, EventKind, Person, PersonInsights } from './types';

// 요일 앵커(window.ts와 동일): 07-06 월 / 07-07 화 / 07-08 수 / 07-09 목 / 07-10 금
//                               07-13 월 / 07-14 화 / 07-15 수 / 07-16 목 / 07-17 금
const NEXT_WEEK = [
  '2026-07-08', '2026-07-09', '2026-07-10',
  '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
];
const THIS_WEEK = ['2026-07-08', '2026-07-09', '2026-07-10']; // 목요일 한 번뿐

const person = (over: Partial<Person>): Person => ({
  id: 'p1', name: '준호', role: 'FE', faceId: 'f1',
  workHours: { start: 540, end: 1080 }, events: [], ...over,
});
const ev = (day: string, start: number, end: number, kind: EventKind, title = '일정'): CalendarEvent => ({
  id: `${day}T${start}`, day, start, end, title, kind,
});

describe('deriveInsights — offsiteWeekdays', () => {
  it('같은 요일 외근 2회↑ → 해당 요일 포함(0=월..4=금)', () => {
    const p = person({ events: [
      ev('2026-07-09', 540, 1080, 'offsite'), // 목
      ev('2026-07-16', 540, 1080, 'offsite'), // 목
    ] });
    const out = deriveInsights(p, NEXT_WEEK);
    expect(out.offsiteWeekdays).toEqual([3]); // 목=3
  });

  it('같은 날 2건이면 distinct day 1 → 미포함', () => {
    const p = person({ events: [
      ev('2026-07-09', 540, 660, 'offsite'),
      ev('2026-07-09', 780, 900, 'offsite'),
    ] });
    expect(deriveInsights(p, NEXT_WEEK).offsiteWeekdays).toEqual([]);
  });

  it('폴백: 창에 요일이 한 번뿐이고 종일급 외근(≥240분)이면 1회로도 포함', () => {
    const p = person({ events: [ev('2026-07-09', 540, 1080, 'offsite')] }); // 목 9h
    expect(deriveInsights(p, THIS_WEEK).offsiteWeekdays).toEqual([3]);
  });

  it('폴백 미적용: 요일 1회 인스턴스라도 짧은 외근(<240분)이면 미포함', () => {
    const p = person({ events: [ev('2026-07-09', 540, 660, 'offsite')] }); // 목 2h
    expect(deriveInsights(p, THIS_WEEK).offsiteWeekdays).toEqual([]);
  });
});

describe('deriveInsights — recurring', () => {
  it('같은 요일+시각 meeting 2회↑ → {weekday,start,title}', () => {
    const p = person({ events: [
      ev('2026-07-06', 600, 660, 'meeting', '스프린트 회의'), // 월 10:00 (창 밖 아님? 07-06은 NEXT_WEEK에 없음)
      ev('2026-07-13', 600, 660, 'meeting', '스프린트 회의'), // 월 10:00
      ev('2026-07-13', 600, 660, 'meeting', '스프린트 회의'), // 같은 날 → distinct day 카운트엔 영향 X
    ] });
    // 07-06은 창 밖 → 07-13만 남아 1회 → 미포함이어야 함(창 필터 검증)
    expect(deriveInsights(p, NEXT_WEEK).recurring).toEqual([]);
  });

  it('창 안에서 2회 반복하면 title은 최초 발생 기준', () => {
    const p = person({ events: [
      ev('2026-07-13', 600, 660, 'meeting', '스프린트 회의'), // 월
      ev('2026-07-20', 600, 660, 'meeting', '스프린트 회의'), // 월(창 밖)
    ] });
    // flexible 창까지 있어야 2회. 여기선 next-week라 07-20 제외 → 1회 → 미포함
    expect(deriveInsights(p, NEXT_WEEK).recurring).toEqual([]);
  });

  it('창 안 2회 반복 meeting 포함, weekday·start 정렬', () => {
    const win = [...NEXT_WEEK, '2026-07-20', '2026-07-21'];
    const p = person({ events: [
      ev('2026-07-14', 840, 900, 'meeting', '1:1'),       // 화 14:00
      ev('2026-07-21', 840, 900, 'meeting', '1:1'),       // 화 14:00
      ev('2026-07-13', 600, 660, 'meeting', '스프린트'),   // 월 10:00
      ev('2026-07-20', 600, 660, 'meeting', '스프린트'),   // 월 10:00
    ] });
    expect(deriveInsights(p, win).recurring).toEqual([
      { weekday: 0, start: 600, title: '스프린트' },
      { weekday: 1, start: 840, title: '1:1' },
    ]);
  });
});

describe('deriveInsights — lunchRhythm', () => {
  it('최빈 (start,end) 쌍', () => {
    const p = person({ events: [
      ev('2026-07-13', 780, 820, 'lunch'),
      ev('2026-07-14', 780, 820, 'lunch'),
      ev('2026-07-15', 720, 760, 'lunch'),
    ] });
    expect(deriveInsights(p, NEXT_WEEK).lunchRhythm).toEqual({ start: 780, end: 820 });
  });

  it('빈도 동률이면 더 이른 start', () => {
    const p = person({ events: [
      ev('2026-07-13', 780, 820, 'lunch'),
      ev('2026-07-14', 720, 760, 'lunch'),
    ] });
    expect(deriveInsights(p, NEXT_WEEK).lunchRhythm).toEqual({ start: 720, end: 760 });
  });

  it('점심 없으면 null', () => {
    expect(deriveInsights(person({}), NEXT_WEEK).lunchRhythm).toBeNull();
  });
});

describe('deriveInsights — headline/scanLine 우선순위(외근>반복>점심)', () => {
  it('외근 → headline·scanLine 모두 외근', () => {
    const p = person({ name: '준호', events: [
      ev('2026-07-09', 540, 1080, 'offsite'),
      ev('2026-07-16', 540, 1080, 'offsite'),
      ev('2026-07-13', 780, 820, 'lunch'), // 점심 있어도 외근 우선
      ev('2026-07-14', 780, 820, 'lunch'),
    ] });
    const out = deriveInsights(p, NEXT_WEEK);
    expect(out.headline).toBe('목요일은 외근이 잦은 편이에요');
    expect(out.scanLine).toBe('준호님의 외근 요일을 확인했어요');
  });

  it('반복(외근 없음) → 매주 문구 + josa, scanLine 정기', () => {
    const p = person({ name: '서연', events: [
      ev('2026-07-13', 600, 660, 'meeting', '스프린트 회의'),
      ev('2026-07-20', 600, 660, 'meeting', '스프린트 회의'),
    ] });
    const out = deriveInsights(p, [...NEXT_WEEK, '2026-07-20']);
    expect(out.headline).toBe('매주 월 오전 10:00 스프린트 회의가 있어요');
    expect(out.scanLine).toBe('서연님의 정기 일정을 기억했어요');
  });

  it('점심만 → 보통 ~쯤, scanLine 점심 리듬', () => {
    const p = person({ name: '하늘', events: [
      ev('2026-07-13', 780, 820, 'lunch'),
      ev('2026-07-14', 780, 820, 'lunch'),
    ] });
    const out = deriveInsights(p, NEXT_WEEK);
    expect(out.headline).toBe('보통 오후 1:00쯤 점심을 먹어요');
    expect(out.scanLine).toBe('하늘님의 점심 리듬을 살폈어요');
  });

  it('패턴 없음 → headline null, scanLine 폴백', () => {
    const p = person({ name: '민수', events: [
      ev('2026-07-13', 600, 720, 'focus'),
      ev('2026-07-14', 600, 720, 'personal'),
    ] });
    const out = deriveInsights(p, NEXT_WEEK);
    expect(out.headline).toBeNull();
    expect(out.scanLine).toBe('민수님의 일정을 확인했어요');
  });
});

describe('한 소스 세 곳 — 피크·스캔·스코어링이 같은 추출을 공유', () => {
  const people: Person[] = [
    person({ id: 'j', name: '준호', events: [
      ev('2026-07-09', 540, 1080, 'offsite'),
      ev('2026-07-16', 540, 1080, 'offsite'),
    ] }),
    person({ id: 's', name: '세훈', events: [
      ev('2026-07-13', 780, 820, 'lunch'),
      ev('2026-07-14', 780, 820, 'lunch'),
      ev('2026-07-15', 780, 820, 'lunch'),
    ] }),
  ];

  it('deriveAllInsights[id]는 deriveInsights와 동일 객체(단일 소스)', () => {
    const all = deriveAllInsights(people, NEXT_WEEK);
    for (const p of people) {
      expect(all[p.id]).toEqual(deriveInsights(p, NEXT_WEEK));
    }
  });

  it('피크 각주(headline)와 스캔 문장(scanLine)이 같은 offsiteWeekdays에서 파생', () => {
    const j = deriveInsights(people[0], NEXT_WEEK);
    expect(j.offsiteWeekdays.length).toBeGreaterThan(0);
    expect(j.headline).toContain('외근');
    expect(j.scanLine).toContain('외근 요일');
  });

  it('스코어링이 읽는 lunchRhythm이 같은 추출 결과 — after-lunch 발화', () => {
    const all = deriveAllInsights(people, NEXT_WEEK);
    const sehun = { ...person({ id: 's', name: '세훈' }), attendanceType: 'required' as const };
    // 리듬 13:00~13:40(780~820) → 직후 13:40 시작 슬롯은 after-lunch
    const { effects } = scoreSlot({
      day: '2026-07-13', start: 820, end: 880, attendees: [sehun], insights: all, rooms: [],
    });
    expect(effects.some((e) => e.code === 'after-lunch' && e.who === 's')).toBe(true);
  });
});
