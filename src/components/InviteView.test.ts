import { describe, it, expect } from 'vitest';
import {
  DIFFICULT_REASONS,
  givenName,
  incomingInviteModel,
  inviteWhenLabel,
  pickPreviewViewer,
  previewInviteModel,
} from './InviteView';
import { INCOMING_INVITE } from '../data/world';
import type { SlotReason } from '../lib/types';

describe('givenName — 성을 뗀 호칭', () => {
  it('3글자 이상은 성을 뗀다: 최민수 → 민수', () => {
    expect(givenName('최민수')).toBe('민수');
    expect(givenName('박준호')).toBe('준호');
  });
  it('2글자 이름은 그대로: 이찬 → 이찬', () => {
    expect(givenName('이찬')).toBe('이찬');
  });
});

describe('inviteWhenLabel — 초대 시각 한 줄', () => {
  it('목 7월 9일 오후 2:00–3:00', () => {
    expect(inviteWhenLabel('2026-07-09', 840, 900)).toBe('목 7월 9일 오후 2:00–3:00');
  });
  it('오전/오후가 갈리면 끝 시각에도 접두어가 붙는다', () => {
    expect(inviteWhenLabel('2026-07-15', 690, 750)).toBe('수 7월 15일 오전 11:30–오후 12:30');
  });
});

describe('incomingInviteModel — 민수의 초대(INCOMING_INVITE) 그대로', () => {
  const model = incomingInviteModel();

  it('헤드라인: 민수님이 회원님 포함 5명과 잡은 1시간', () => {
    expect(model.headline).toBe('민수님이 회원님 포함 5명과 잡은 1시간');
    expect(model.fromId).toBe('minsu');
  });
  it('제목·시각·이유가 세계 데이터와 일치한다', () => {
    expect(model.title).toBe(INCOMING_INVITE.title);
    expect(model.whenLabel).toBe('목 7월 9일 오후 2:00–3:00');
    expect(model.reasons).toEqual(INCOMING_INVITE.reasonsForMe);
  });
  it('내 이야기 행(첫 줄)이 강조 행이다', () => {
    expect(model.highlightIndex).toBe(0);
    expect(model.reasons[0].text).toContain('회원님');
  });
});

// ── preview — 내가 보낸 초대의 수신자 관점 ─────────────────────────

const attendees = [
  { id: 'ichan', name: '이찬', isOrganizer: true },
  { id: 'junho', name: '박준호' },
  { id: 'haneul', name: '정하늘' },
];

const reason = (code: SlotReason['code'], who?: string): SlotReason => ({
  code,
  tone: 'tradeoff',
  text: `${who ?? ''} 이유`,
  who,
});

describe('pickPreviewViewer — 수신자 선택', () => {
  it('reasons에 언급된(who) 첫 수신자를 고른다 — 강조 행이 살아있는 미리보기', () => {
    const slot = { reasons: [reason('optional-partial', 'haneul')], partials: [] };
    expect(pickPreviewViewer(slot, attendees)?.id).toBe('haneul');
  });
  it('partials 대상도 언급으로 본다', () => {
    const slot = {
      reasons: [],
      partials: [{ attendeeId: 'haneul', part: 'front' as const, minutes: 30, conflictTitle: '콘텐츠 리뷰' }],
    };
    expect(pickPreviewViewer(slot, attendees)?.id).toBe('haneul');
  });
  it('언급이 여럿이면 참석자 순서상 앞선 사람 — 준호가 하늘보다 먼저다', () => {
    const slot = { reasons: [reason('offsite-day', 'haneul'), reason('back-to-back', 'junho')], partials: [] };
    expect(pickPreviewViewer(slot, attendees)?.id).toBe('junho');
  });
  it('아무도 언급되지 않으면 첫 수신자(기본 캐스트에선 준호)', () => {
    const slot = { reasons: [reason('all-required-ok')], partials: [] };
    expect(pickPreviewViewer(slot, attendees)?.id).toBe('junho');
  });
  it('주최자는 수신자가 아니다 — 혼자면 null', () => {
    const slot = { reasons: [], partials: [] };
    expect(pickPreviewViewer(slot, [{ id: 'ichan', name: '이찬', isOrganizer: true }])).toBeNull();
  });
});

describe('previewInviteModel — 데이터 소스 전환(binding 2)', () => {
  const slot = {
    day: '2026-07-15',
    reasons: [reason('all-required-ok'), reason('optional-partial', 'haneul')],
    partials: [{ attendeeId: 'haneul', part: 'front' as const, minutes: 30, conflictTitle: '콘텐츠 리뷰' }],
  };

  it('보낸 사람은 나(이찬), 수신자 관점 헤드라인·시각은 조정 반영 시간', () => {
    const preview = previewInviteModel({ slot, attendees, title: '', adjusted: { start: 600, end: 660 } })!;
    expect(preview.viewerName).toBe('하늘'); // 언급된 수신자
    expect(preview.model.fromId).toBe('ichan');
    expect(preview.model.headline).toBe('이찬님이 회원님 포함 3명과 잡은 1시간');
    expect(preview.model.title).toBe('팀 회의'); // 제목 미입력 기본값(CONFIRM과 동일)
    expect(preview.model.whenLabel).toBe('수 7월 15일 오전 10:00–11:00');
  });

  it('수신자가 언급된 행이 강조 행이다', () => {
    const preview = previewInviteModel({ slot, attendees, title: '킥오프', adjusted: { start: 600, end: 660 } })!;
    expect(preview.model.title).toBe('킥오프');
    expect(preview.model.highlightIndex).toBe(1); // who === haneul
    expect(preview.model.reasons).toEqual(slot.reasons); // 슬롯 reasons 재사용(하드코딩 없음)
  });

  it('아무 행에도 언급이 없으면 강조 없음(-1)', () => {
    const quiet = { day: '2026-07-15', reasons: [reason('all-required-ok')], partials: [] };
    const preview = previewInviteModel({ slot: quiet, attendees, title: '', adjusted: { start: 600, end: 660 } })!;
    expect(preview.viewerName).toBe('준호'); // 폴백: 첫 수신자
    expect(preview.model.highlightIndex).toBe(-1);
  });

  it('수신자가 없으면(혼자) null — 호출부 가드 대상', () => {
    const preview = previewInviteModel({
      slot,
      attendees: [{ id: 'ichan', name: '이찬', isOrganizer: true }],
      title: '',
      adjusted: { start: 600, end: 660 },
    });
    expect(preview).toBeNull();
  });
});

describe('DIFFICULT_REASONS — 어려워요 사유 칩', () => {
  it('4개 고정: 일정이 겹쳐요/외근이에요/시간이 촉박해요/기타', () => {
    expect(DIFFICULT_REASONS).toEqual(['일정이 겹쳐요', '외근이에요', '시간이 촉박해요', '기타']);
  });
});
