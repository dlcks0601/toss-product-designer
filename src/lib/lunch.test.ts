import { describe, it, expect } from 'vitest';
import { afterLunchEffect, beforeLunchEffect, lunchSqueezeEffect } from './lunch';
import { SCORING } from './scoring';
import type { Attendee, CalendarEvent, EventKind, LunchRhythm } from './types';

const person = (over: Partial<Attendee> = {}): Attendee => ({
  id: 'p1', name: '세훈', role: 'PO', faceId: 'f1',
  attendanceType: 'required', workHours: { start: 540, end: 1080 }, events: [], ...over,
});
const ev = (start: number, end: number, kind: EventKind = 'meeting', title = '일정'): CalendarEvent => ({
  id: `e${start}`, day: '2026-07-07', start, end, title, kind,
});

// 리듬 13:00~13:40 → start 780, end 820.
const rhythm1340: LunchRhythm = { start: 780, end: 820 };

describe('afterLunchEffect — 점심 직후 나른함', () => {
  it('리듬 13:00~13:40인 사람: 13:40~14:10 시작은 감점, 14:10 이후는 무감점', () => {
    // 13:40=820 → [820,850) 안 → 감점. 14:10=850 → 경계 밖 → 무감점.
    const at1340 = afterLunchEffect(person(), rhythm1340, 820);
    expect(at1340).not.toBeNull();
    expect(at1340!.code).toBe('after-lunch');
    expect(at1340!.delta).toBe(SCORING.afterLunch);
    expect(at1340!.who).toBe('p1');
    expect(afterLunchEffect(person(), rhythm1340, 850)).toBeNull(); // 상한 배타
    expect(afterLunchEffect(person(), rhythm1340, 810)).toBeNull(); // 아직 점심 중(하한 미만)
  });

  it('리듬 null이면 after-lunch 없음 — 예측하지 않는다', () => {
    expect(afterLunchEffect(person(), null, 820)).toBeNull();
    expect(afterLunchEffect(person(), null, 840)).toBeNull();
  });

  it('S2 재현: 세훈(리듬 13:00) 화 14:00 시작 → after-lunch + 완화 데이터(10분 늦추기 가능)', () => {
    // 리듬 13:00~13:40, 슬롯 시작 14:00=840. [820,850) 안 → 감점.
    const eff = afterLunchEffect(person({ name: '세훈' }), rhythm1340, 840);
    expect(eff).not.toBeNull();
    expect(eff!.code).toBe('after-lunch');
    expect(eff!.data).toMatchObject({ rhythmStart: 780, rhythmEnd: 820 });
    // 완화: 리듬 종료(820)+30 = 850까지 나른 → 850−840 = 10분만 늦추면 벗어난다.
    const pushLater = (Number(eff!.data!.rhythmEnd) + 30) - 840;
    expect(pushLater).toBe(10);
  });
});

describe('beforeLunchEffect — 점심 직전 보너스(duration 상대)', () => {
  it('30분 회의도 진짜 직전 슬롯(리듬 시작에 딱 끝남)이면 가점', () => {
    // 리듬 시작 780. 12:30~13:00(750~780) 30분 회의 → slotEnd 780 = start → 가점.
    const eff = beforeLunchEffect(person(), rhythm1340, 780);
    expect(eff).not.toBeNull();
    expect(eff!.code).toBe('before-lunch-bonus');
    expect(eff!.delta).toBe(SCORING.beforeLunch);
    // (start−30, start] = (750, 780]. 760은 안, 750은 경계 밖.
    expect(beforeLunchEffect(person(), rhythm1340, 760)).not.toBeNull();
    expect(beforeLunchEffect(person(), rhythm1340, 750)).toBeNull(); // 하한 배타
    expect(beforeLunchEffect(person(), rhythm1340, 740)).toBeNull(); // 30분보다 이른 종료
    expect(beforeLunchEffect(person(), rhythm1340, 800)).toBeNull(); // 리듬 시작 이후 종료
  });

  it('리듬 null이면 보너스 없음', () => {
    expect(beforeLunchEffect(person(), null, 780)).toBeNull();
  });
});

describe('lunchSqueezeEffect — 점심 보호', () => {
  it('오후가 꽉 찬 사람: 11~12시 회의가 들어가면 점심 여유 30분 → lunch-squeeze', () => {
    // 기존 12:30~15:00(750~900) 회의 + 제안 슬롯 11:00~12:00(660~720) → 빈 구간 12:00~12:30 = 30분.
    const p = person({ events: [ev(750, 900, 'meeting', '오후 블록')] });
    const eff = lunchSqueezeEffect(p, '2026-07-07', { start: 660, end: 720 });
    expect(eff).not.toBeNull();
    expect(eff!.code).toBe('lunch-squeeze');
    expect(eff!.delta).toBe(SCORING.lunchSqueeze);
    expect(eff!.who).toBe('p1');
    expect(eff!.data).toMatchObject({ gap: 30 });
  });

  it('여유 60분 이상 남으면 침묵', () => {
    // 기존 13:00~15:00(780~900) + 슬롯 11:00~12:00(660~720) → 빈 구간 12:00~13:00 = 60분(경계 미충족).
    const p = person({ events: [ev(780, 900, 'meeting', '오후 블록')] });
    expect(lunchSqueezeEffect(p, '2026-07-07', { start: 660, end: 720 })).toBeNull();
  });

  it('점심(lunch) 일정은 점유로 세지 않는다 — 움직일 수 있으니까', () => {
    // 12:30~13:00 점심(무시) + 13:00~15:00 회의 + 슬롯 11:00~12:00 → 빈 구간 12:00~13:00 = 60분 → 침묵.
    const p = person({ events: [ev(750, 780, 'lunch', '점심'), ev(780, 900, 'meeting', '오후 블록')] });
    expect(lunchSqueezeEffect(p, '2026-07-07', { start: 660, end: 720 })).toBeNull();
  });

  it('슬롯이 점심 창(660~900)과 안 겹치면 검사하지 않는다 — 오후가 꽉 차 있어도', () => {
    const p = person({ events: [ev(660, 900, 'meeting', '점심 내내 회의')] });
    // 슬롯 15:00~16:00(900~960): 창과 경계만 맞닿음 → 겹침 아님 → null.
    expect(lunchSqueezeEffect(p, '2026-07-07', { start: 900, end: 960 })).toBeNull();
    // 슬롯 09:00~10:00(540~600): 창 이전 → null.
    expect(lunchSqueezeEffect(p, '2026-07-07', { start: 540, end: 600 })).toBeNull();
  });

  it('다른 날 일정은 그날 점유에 포함되지 않는다', () => {
    // 오늘(07-07) 슬롯 11:00~14:30(660~870, 여유 30분 남을 만큼 김) 자체로는 창 대부분 차지.
    // 다른 날(07-08) 회의는 무관 → 슬롯만으로 남는 여유가 60분 이상이면 침묵.
    const other: CalendarEvent = { id: 'x', day: '2026-07-08', start: 780, end: 900, title: '내일', kind: 'meeting' };
    const p = person({ events: [other] });
    // 슬롯 11:00~12:00(660~720) → 창 나머지 720~900 = 180분 여유 → 침묵.
    expect(lunchSqueezeEffect(p, '2026-07-07', { start: 660, end: 720 })).toBeNull();
  });
});
