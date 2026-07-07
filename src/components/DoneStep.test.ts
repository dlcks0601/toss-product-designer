import { describe, expect, it } from 'vitest';
import { careItems, placeLabel } from './DoneStep';
import type { PartialInfo, SlotReason } from '../lib/types';

const attendees = [
  { id: 'ichan', name: '이찬' },
  { id: 'junho', name: '박준호' },
  { id: 'haneul', name: '정하늘' },
];

const partial = (over: Partial<PartialInfo> = {}): PartialInfo => ({
  attendeeId: 'haneul',
  part: 'front',
  minutes: 30,
  conflictTitle: '디자인 워크숍',
  ...over,
});

const offsiteReason: SlotReason = {
  code: 'offsite-day',
  tone: 'warning',
  text: '박준호님 외근 날이에요 — 화상으로 합류할 수 있어요',
  who: 'junho',
};

const none = { delayTen: false, fiftyMin: false };

describe('careItems — 슬롯 사실에서만 파생(하드코딩 금지)', () => {
  it('부분 참석자 1명 → 양해 문구·안건 배치·퇴장 알림 3항목', () => {
    const items = careItems({
      slot: { reasons: [], partials: [partial()] },
      attendees,
      mitigations: none,
    });
    expect(items).toEqual([
      '정하늘님 초대에 "앞 30분만 함께해도 충분해요" 문구를 담았어요',
      '정하늘님 몫 안건을 앞쪽에 배치하는 걸 추천했어요',
      '정하늘님 퇴장 5분 전에 알려드릴게요',
    ]);
  });

  it('뒤 참석(back)이면 문구·배치가 뒤쪽으로 맞춰진다', () => {
    const items = careItems({
      slot: { reasons: [], partials: [partial({ part: 'back', minutes: 25 })] },
      attendees,
      mitigations: none,
    });
    expect(items[0]).toContain('"뒤 25분만 함께해도 충분해요"');
    expect(items[1]).toContain('뒤쪽에 배치');
  });

  it('offsite-day 이유 → 외근 대비 화상 링크 항목', () => {
    const items = careItems({
      slot: { reasons: [offsiteReason], partials: [] },
      attendees,
      mitigations: none,
    });
    expect(items).toEqual(['박준호님 외근 대비 화상 링크를 넣어뒀어요']);
  });

  it('완화 선택이 항목으로 남는다 — delayTen·fiftyMin', () => {
    const items = careItems({
      slot: { reasons: [], partials: [] },
      attendees,
      mitigations: { delayTen: true, fiftyMin: true },
    });
    expect(items).toEqual([
      '모두의 점심 여유를 위해 10분 늦춰 시작해요',
      '다음 일정을 위해 50분으로 마쳐요',
    ]);
  });

  it('챙길 것이 없으면 빈 배열 — 카드 자체가 생략된다', () => {
    expect(careItems({ slot: { reasons: [], partials: [] }, attendees, mitigations: none })).toEqual([]);
  });

  it('참석자 목록에 없는 인물(딥링크 오염)은 조용히 건너뛴다', () => {
    const items = careItems({
      slot: {
        reasons: [{ ...offsiteReason, who: 'ghost' }],
        partials: [partial({ attendeeId: 'ghost' })],
      },
      attendees,
      mitigations: none,
    });
    expect(items).toEqual([]);
  });
});

describe('placeLabel', () => {
  const rooms = [{ id: 'room-2', name: '미팅룸 2' }];
  it("'remote'는 화상", () => {
    expect(placeLabel('remote', rooms)).toBe('화상');
  });
  it('회의실 id는 이름으로', () => {
    expect(placeLabel('room-2', rooms)).toBe('미팅룸 2');
  });
  it('미선택(null)·미상 id는 null — 서브 라인에서 생략', () => {
    expect(placeLabel(null, rooms)).toBeNull();
    expect(placeLabel('unknown', rooms)).toBeNull();
  });
});
