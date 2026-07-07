/**
 * 목데이터 각본(世界) — 데모의 대본이다.
 *
 * 원칙: 핵심 6인은 각자 챌린지 단서 하나를 몸으로 구현한다. 엔진이 그 단서를 "읽는" 순간이
 * 곧 데모 장면(S1~S6)이다. 나머지 14인은 참석자 선택이 진짜 선택이 되도록 조직을 20명으로
 * 넓히는, 그러나 전원 정품질(근무리듬·패턴 보유)인 인물들이다.
 *
 * 앵커 2026-07-07(화). 창(window.ts):
 *  - this-week = [7/8, 7/9, 7/10]
 *  - next-week = + [7/13 … 7/17]
 *  - flexible  = + [7/20 … 7/24]
 * 이벤트는 7/6~7/24 전 기간에 걸친다(홈 캘린더는 현재 주 7/6~7/10을 보여준다).
 *
 * 시간은 자정 기준 분. 참고: 600=10:00, 660=11:00, 720=12:00, 780=13:00, 840=14:00,
 * 900=15:00, 960=16:00, 1020=17:00, 1080=18:00.
 *
 * ⚠️ src/lib 은 고정 계약이다. 장면이 안 맞으면 엔진이 아니라 이 데이터를 조율한다.
 * 장면 계약의 근거는 world.test.ts 의 불변식이다.
 */
import type { Attendee, CalendarEvent, EventKind, Person, Room, SlotReason } from '../lib/types';

export const ME_ID = 'ichan';

/** 데모 기본 6인 — 조율 화면에 상시 등장하는 각본의 주연들. */
export const CORE_CAST: string[] = ['ichan', 'junho', 'seoyeon', 'minsu', 'haneul', 'sehun'];

// ── 날짜 상수 ──────────────────────────────────────────────
// 현재 주(홈 캘린더에 보이는 주)
const W0_MON = '2026-07-06';
const W0_TUE = '2026-07-07';
const W0_WED = '2026-07-08';
const W0_THU = '2026-07-09';
const W0_FRI = '2026-07-10';
// 다음 주(next-week)
const W1_MON = '2026-07-13';
const W1_TUE = '2026-07-14';
const W1_WED = '2026-07-15';
const W1_THU = '2026-07-16';
const W1_FRI = '2026-07-17';
// 그 다음 주(flexible)
const W2_MON = '2026-07-20';
const W2_TUE = '2026-07-21';
const W2_WED = '2026-07-22';
const W2_THU = '2026-07-23';
const W2_FRI = '2026-07-24';

/** 이벤트 팩토리 — 결정적 id. */
function ev(id: string, day: string, start: number, end: number, title: string, kind: EventKind, room?: string, external?: boolean): CalendarEvent {
  return { id, day, start, end, title, kind, room, external };
}

// ── 핵심 6인 ───────────────────────────────────────────────

/**
 * 이찬(나) — PM·주최자. lunchRhythm 12:00~13:30(자율 점심 90분). 보통의 미팅 부하.
 * next-week: Wed 10:00 별 슬롯을 위해 오전은 비우고 오후 미팅으로 벽을 만든다.
 */
const ichan: Person = {
  id: 'ichan', name: '이찬', role: 'Product Manager', faceId: 'ichan',
  workHours: { start: 540, end: 1080 },
  events: [
    // ── 현재 주(캘린더용 + S4 this-week) : 오전은 비워 junho 병목이 드러나게 ──
    ev('ichan-w0-1', W0_MON, 690, 780, '주간 스프린트 계획', 'meeting', '미팅룸 3'),
    ev('ichan-w0-2', W0_TUE, 660, 780, '제품 리뷰', 'meeting', 'UT룸', true),
    ev('ichan-w0-l1', W0_WED, 720, 810, '점심', 'lunch'),
    ev('ichan-w0-3', W0_WED, 840, 960, '로드맵 정리', 'meeting', '미팅룸 2'),
    ev('ichan-w0-l2', W0_THU, 720, 810, '점심', 'lunch'),
    // 900-1020(15:00-17:00): INCOMING_INVITE(목 14:00-15:00)와 겹치지 않도록 뒤로 민다.
    ev('ichan-w0-4', W0_THU, 900, 1020, '이해관계자 싱크', 'meeting', '미팅룸 5', true),
    ev('ichan-w0-l3', W0_FRI, 720, 810, '점심', 'lunch'),
    ev('ichan-w0-5', W0_FRI, 960, 1080, '주간 마감 회의', 'meeting', '미팅룸 1'),

    // ── 다음 주(next-week) : S1 무대 ──
    ev('ichan-w1-l1', W1_MON, 720, 810, '점심', 'lunch'),
    ev('ichan-w1-1', W1_MON, 810, 930, '팀 미팅', 'meeting', '미팅룸 2'),
    ev('ichan-w1-l2', W1_TUE, 720, 810, '점심', 'lunch'),
    ev('ichan-w1-2', W1_TUE, 600, 720, '제품 리뷰', 'meeting', 'UT룸', true),
    ev('ichan-w1-3', W1_TUE, 960, 1080, '스폰서 리뷰', 'meeting', '미팅룸 5', true),
    ev('ichan-w1-l3', W1_WED, 720, 810, '점심', 'lunch'),
    ev('ichan-w1-3b', W1_WED, 900, 1080, '분기 리뷰', 'meeting', '미팅룸 1'),
    ev('ichan-w1-l4', W1_THU, 720, 810, '점심', 'lunch'),
    ev('ichan-w1-4', W1_THU, 900, 1020, '채용 인터뷰', 'meeting', '미팅룸 3', true),
    ev('ichan-w1-l5', W1_FRI, 720, 810, '점심', 'lunch'),
    ev('ichan-w1-5', W1_FRI, 810, 930, '위클리 랩업', 'meeting', '미팅룸 4'),

    // ── flexible ──
    // Mon 은 11:30~13:00 회의라 이날만 13:00 으로 미룬다(자율 점심 — 그날 사정에 맞춘다).
    ev('ichan-w2-l1', W2_MON, 780, 870, '점심', 'lunch'),
    ev('ichan-w2-1', W2_MON, 690, 780, '주간 스프린트 계획', 'meeting'),
    ev('ichan-w2-l2', W2_WED, 720, 810, '점심', 'lunch'),
    ev('ichan-w2-2', W2_WED, 840, 960, '로드맵 정리', 'meeting'),
  ],
};

/**
 * 박준호 — FE. 목요일 외근(패턴) + 매주 월 10:00 스프린트. S3(목 외근)·S4(이번 주 병목) 소재.
 * this-week: Wed/Fri 는 30분 틈(630~660)만 남기고 벽, Thu 는 종일 외근 → 60분 후보 0,
 *            준호 부분 허용 시에만 슬롯이 열린다.
 * next-week: Thu 오후 외근(≥240분 → 목요일 외근 헤드라인), Thu 오전은 비워 S3 11:00 슬롯을 연다.
 * 자율 점심 11:30~12:45(75분). 벽·마라톤 회의로 점심 틈이 없는 날은 점심을 거른다(그 자체가 각본).
 */
const junho: Person = {
  id: 'junho', name: '박준호', role: 'Frontend Engineer', faceId: 'junho',
  workHours: { start: 540, end: 1080 },
  events: [
    // ── 현재 주 : S4 병목(이번 주 남은 3일을 준호가 잠근다) ──
    ev('junho-w0-1', W0_MON, 600, 690, '스프린트 계획', 'meeting'),
    ev('junho-w0-l0', W0_MON, 690, 765, '점심', 'lunch'),
    ev('junho-w0-2', W0_TUE, 600, 720, '프론트 팀 싱크', 'meeting'),
    // Tue 는 12:00 까지 회의라 이날만 12:00 으로 미룬다.
    ev('junho-w0-l1', W0_TUE, 720, 795, '점심', 'lunch'),
    // Wed 7/8 : 600~630, 660~1080 벽 · 630~660 만 빈다(부분 허용 슬롯의 씨앗)
    ev('junho-w0-3a', W0_WED, 600, 630, '데일리 스크럼', 'meeting'),
    ev('junho-w0-3b', W0_WED, 660, 780, 'API 설계 리뷰', 'meeting'),
    ev('junho-w0-3c', W0_WED, 780, 900, '릴리즈 점검', 'meeting'),
    ev('junho-w0-3d', W0_WED, 900, 1080, '장애 대응 대기', 'meeting'),
    // Thu 7/9 : 종일 외근
    ev('junho-w0-4', W0_THU, 540, 1080, '외근 — 파트너사 상주', 'offsite'),
    // Fri 7/10 : Wed 와 같은 30분 틈 패턴
    ev('junho-w0-5a', W0_FRI, 600, 630, '데일리 스크럼', 'meeting'),
    ev('junho-w0-5b', W0_FRI, 660, 780, '스프린트 리뷰', 'meeting'),
    ev('junho-w0-5c', W0_FRI, 780, 900, 'QA 싱크', 'meeting'),
    ev('junho-w0-5d', W0_FRI, 900, 1080, '배포', 'meeting'),

    // ── 다음 주(next-week) ──
    ev('junho-w1-1', W1_MON, 600, 690, '스프린트 계획', 'meeting'),
    ev('junho-w1-l1', W1_MON, 690, 765, '점심', 'lunch'),
    ev('junho-w1-1b', W1_MON, 810, 1080, '리팩터링 페어링', 'meeting'),
    // Tue 는 10:00~14:00 마라톤 회의 — 점심 틈이 없다(화 14:00 슬롯의 lunch-squeeze 소재).
    ev('junho-w1-2', W1_TUE, 600, 840, '프론트 팀 싱크', 'meeting'),
    ev('junho-w1-2b', W1_TUE, 900, 1080, '코드 리뷰 타임', 'meeting'),
    // Wed 별 슬롯(10:00)에 back-to-back 을 남기지 않도록 690 부터 시작한다. 11:30~15:00 이라 점심 없음.
    ev('junho-w1-3', W1_WED, 690, 900, '컴포넌트 마이그레이션', 'meeting'),
    // Thu 7/16 : 오전 비움(점심은 리듬대로), 오후 외근(≥240분)
    ev('junho-w1-l4', W1_THU, 690, 765, '점심', 'lunch'),
    ev('junho-w1-4', W1_THU, 780, 1080, '외근 — 파트너사 미팅', 'offsite'),
    // Fri 는 11:00~18:00 벽 — 점심 없음.
    ev('junho-w1-5', W1_FRI, 660, 900, 'API 연동 리뷰', 'meeting'),
    ev('junho-w1-5b', W1_FRI, 900, 1080, '배포 준비', 'meeting'),

    // ── flexible ──
    ev('junho-w2-1', W2_MON, 600, 690, '스프린트 계획', 'meeting'),
    ev('junho-w2-l1', W2_MON, 690, 765, '점심', 'lunch'),
    ev('junho-w2-2', W2_THU, 540, 900, '외근 — 파트너사 미팅', 'offsite'),
  ],
};

/**
 * 이서연 — Data. 화·수 오전 focus(9:00~11:30, soft) + 목 오후 빽빽(점심 없이 12:30~17:30 연쇄)
 * → 목 11:00 슬롯이 lunch-squeeze. S3 소재. 자율 점심 12:15~13:30(75분) — 목요일만 점심이 없다.
 */
const seoyeon: Person = {
  id: 'seoyeon', name: '이서연', role: 'Data Analyst', faceId: 'seoyeon',
  workHours: { start: 540, end: 1080 },
  events: [
    // ── 현재 주 : 오전 비움(병목은 junho) + focus 화·수 ──
    ev('seoyeon-w0-f1', W0_TUE, 540, 690, '집중 작업 — 지표 분석', 'focus'),
    ev('seoyeon-w0-l1', W0_TUE, 735, 810, '점심', 'lunch'),
    ev('seoyeon-w0-f2', W0_WED, 540, 690, '집중 작업 — 리포트', 'focus'),
    ev('seoyeon-w0-l2', W0_WED, 735, 810, '점심', 'lunch'),
    ev('seoyeon-w0-1', W0_WED, 840, 960, '데이터 리뷰', 'meeting'),
    ev('seoyeon-w0-2', W0_THU, 840, 1020, '지표 공유', 'meeting'),
    ev('seoyeon-w0-l3', W0_FRI, 735, 810, '점심', 'lunch'),
    ev('seoyeon-w0-3', W0_FRI, 840, 960, '리서치 싱크', 'meeting'),

    // ── 다음 주(next-week) ──
    ev('seoyeon-w1-l1', W1_MON, 735, 810, '점심', 'lunch'),
    ev('seoyeon-w1-1b', W1_MON, 810, 1080, '대시보드 작업', 'meeting'),
    ev('seoyeon-w1-f1', W1_TUE, 540, 690, '집중 작업 — 지표 분석', 'focus'),
    ev('seoyeon-w1-l2', W1_TUE, 735, 810, '점심', 'lunch'),
    ev('seoyeon-w1-2', W1_TUE, 900, 1080, 'A/B 결과 리뷰', 'meeting'),
    // Wed focus 는 별 슬롯(10:00~11:00)과 겹치지 않게 11:00 부터 — soft 라 슬롯을 막지는 않는다.
    ev('seoyeon-w1-f2', W1_WED, 660, 810, '집중 작업 — 리포트', 'focus'),
    // Thu 7/16 : 점심 없이 12:30부터 연쇄 → 11:00 슬롯 lunch-squeeze
    ev('seoyeon-w1-4a', W1_THU, 750, 870, '데이터 리뷰', 'meeting'),
    ev('seoyeon-w1-4b', W1_THU, 870, 990, '모델링 싱크', 'meeting'),
    ev('seoyeon-w1-4c', W1_THU, 990, 1050, '지표 공유', 'meeting'),
    // Fri 는 11:30~13:30 회의라 이날만 13:30 으로 미룬다(자율 점심).
    ev('seoyeon-w1-l5', W1_FRI, 810, 885, '점심', 'lunch'),
    ev('seoyeon-w1-5', W1_FRI, 690, 810, '리서치 싱크', 'meeting'),

    // ── flexible ──
    ev('seoyeon-w2-l1', W2_TUE, 735, 810, '점심', 'lunch'),
    ev('seoyeon-w2-f1', W2_TUE, 540, 690, '집중 작업 — 지표 분석', 'focus'),
    ev('seoyeon-w2-1', W2_WED, 840, 960, '데이터 리뷰', 'meeting'),
  ],
};

/**
 * 최민수 — Design. workHours 600~1140(10~19시 유연근무, 필수 프레임 시작=10:00을 결정) + 정기 디자인 크리틱.
 * 자율 점심 11:45~13:00(75분). 화(next-week)는 워크숍이 점심 창을 덮어 점심이 없다.
 */
const minsu: Person = {
  id: 'minsu', name: '최민수', role: 'Product Designer', faceId: 'minsu',
  workHours: { start: 600, end: 1140 },
  events: [
    // ── 현재 주 : 오전 비움 ──
    ev('minsu-w0-l1', W0_WED, 705, 780, '점심', 'lunch'),
    ev('minsu-w0-1', W0_WED, 840, 960, '디자인 크리틱', 'meeting'),
    ev('minsu-w0-l2', W0_THU, 705, 780, '점심', 'lunch'),
    // 900-1080(15:00-18:00): INCOMING_INVITE(목 14:00-15:00)와 겹치지 않도록 뒤로 민다.
    ev('minsu-w0-2', W0_THU, 900, 1080, '디자인 시스템 정리', 'meeting'),
    ev('minsu-w0-l3', W0_FRI, 705, 780, '점심', 'lunch'),
    ev('minsu-w0-3', W0_FRI, 780, 900, '리뷰', 'meeting'),

    // ── 다음 주(next-week) ──
    ev('minsu-w1-l1', W1_MON, 705, 780, '점심', 'lunch'),
    ev('minsu-w1-1b', W1_MON, 810, 1080, '포트폴리오 리뷰', 'meeting'),
    // Tue 는 10:00~14:00 디자인 워크숍 — 점심 틈이 없다(화 14:00 슬롯의 lunch-squeeze 소재).
    ev('minsu-w1-2', W1_TUE, 600, 840, '디자인 워크숍', 'meeting'),
    ev('minsu-w1-l3', W1_WED, 705, 780, '점심', 'lunch'),
    ev('minsu-w1-3', W1_WED, 780, 900, '디자인 크리틱', 'meeting'),
    // Thu 7/16 : 600~660 크리틱으로 오전 앞부분을 막아 S3 후보를 11:00~ 로 좁힌다
    ev('minsu-w1-4a', W1_THU, 600, 660, '디자인 크리틱', 'meeting'),
    ev('minsu-w1-l4', W1_THU, 705, 780, '점심', 'lunch'),
    ev('minsu-w1-4b', W1_THU, 780, 960, '디자인 시스템 정리', 'meeting'),
    ev('minsu-w1-l5', W1_FRI, 705, 780, '점심', 'lunch'),
    ev('minsu-w1-5', W1_FRI, 780, 960, '브랜드 리뷰', 'meeting'),

    // ── flexible ──
    ev('minsu-w2-l1', W2_WED, 705, 780, '점심', 'lunch'),
    ev('minsu-w2-1', W2_WED, 780, 900, '디자인 크리틱', 'meeting'),
  ],
};

/**
 * 정하늘 — Marketing(선택). 화 외근(종일, ≥240분 → 화요일 외근 헤드라인) + 수 10:30~12:00 회의
 * (→ S1: 수 10:00 슬롯에서 앞 30분 부분 참석) + 매주 월 16:00 정기 미팅.
 * 다른 후보 슬롯에서는 바빠서 불참 → Wed 10:00 만이 하늘이 함께하는 슬롯이 되게 한다.
 * 자율 점심 12:00~13:00(60분) — 수요일은 회의 사이 딱 60분. 목·금(next-week)은 오전 회의 뒤 13:00~14:15.
 */
const haneul: Person = {
  id: 'haneul', name: '정하늘', role: 'Marketing Manager', faceId: 'haneul',
  workHours: { start: 540, end: 1080 },
  events: [
    // ── 현재 주 ──
    ev('haneul-w0-1', W0_MON, 960, 1020, '캠페인 정기 회의', 'meeting'),
    ev('haneul-w0-2', W0_TUE, 540, 1020, '외근 — 고객사 방문', 'offsite'),
    ev('haneul-w0-l1', W0_WED, 720, 780, '점심', 'lunch'),
    ev('haneul-w0-3', W0_WED, 660, 720, '콘텐츠 리뷰', 'meeting'),
    ev('haneul-w0-4', W0_THU, 840, 960, '퍼포먼스 리뷰', 'meeting'),
    ev('haneul-w0-l2', W0_FRI, 720, 780, '점심', 'lunch'),
    ev('haneul-w0-5', W0_FRI, 840, 960, '제휴 미팅', 'meeting'),

    // ── 다음 주(next-week) : S1 ──
    // Mon : 오전(10:00~13:30)을 채워 Mon 후보 슬롯 전부에서 불참
    ev('haneul-w1-1', W1_MON, 600, 810, '캠페인 브리핑', 'meeting'),
    ev('haneul-w1-1b', W1_MON, 960, 1020, '캠페인 정기 회의', 'meeting'),
    // Tue : 종일 외근(≥240분)
    ev('haneul-w1-2', W1_TUE, 540, 1020, '외근 — 고객사 방문', 'offsite'),
    // Wed : 10:30~12:00 회의 → 10:00 슬롯 앞 30분만 가능
    ev('haneul-w1-l3', W1_WED, 720, 780, '점심', 'lunch'),
    ev('haneul-w1-3', W1_WED, 630, 720, '콘텐츠 리뷰', 'meeting'),
    ev('haneul-w1-3b', W1_WED, 780, 900, '광고 소재 리뷰', 'meeting'),
    // Thu : 오전을 채워 S3 슬롯에서 불참
    ev('haneul-w1-4', W1_THU, 600, 780, '퍼포먼스 리뷰', 'meeting'),
    ev('haneul-w1-l4', W1_THU, 780, 855, '점심', 'lunch'),
    // Fri : 오전을 채워 불참
    ev('haneul-w1-5', W1_FRI, 600, 780, '제휴 미팅', 'meeting'),
    ev('haneul-w1-l5', W1_FRI, 780, 855, '점심', 'lunch'),

    // ── flexible ──
    ev('haneul-w2-1', W2_TUE, 540, 1020, '외근 — 고객사 방문', 'offsite'),
    ev('haneul-w2-l1', W2_WED, 720, 780, '점심', 'lunch'),
  ],
};

/**
 * 오세훈 — BE(선택). lunchRhythm 13:00~14:00(자율 점심 60분) + 촘촘한 일정 → 화 14:00 시작 = after-lunch 발동.
 * S2 소재. 다른 후보 슬롯에선 바빠서 불참, 화 14:00 만 세훈이 온전히 참석(after-lunch 경고).
 * 점심 종료 840 → after-lunch 창 [840, 870) 에 화 14:00(840) 시작이 정확히 걸린다.
 */
const sehun: Person = {
  id: 'sehun', name: '오세훈', role: 'Backend Engineer', faceId: 'sehun',
  workHours: { start: 540, end: 1080 },
  events: [
    // ── 현재 주 ──
    ev('sehun-w0-1', W0_MON, 600, 720, '배포 점검', 'meeting'),
    ev('sehun-w0-l1', W0_MON, 780, 840, '점심', 'lunch'),
    ev('sehun-w0-2', W0_TUE, 630, 780, '인프라 점검', 'meeting'),
    ev('sehun-w0-l2', W0_TUE, 780, 840, '점심', 'lunch'),
    ev('sehun-w0-l3', W0_WED, 780, 840, '점심', 'lunch'),
    ev('sehun-w0-3', W0_WED, 900, 1020, '장애 회고', 'meeting'),
    ev('sehun-w0-l4', W0_THU, 780, 840, '점심', 'lunch'),
    ev('sehun-w0-4', W0_THU, 660, 780, 'DB 마이그레이션', 'meeting'),
    ev('sehun-w0-l5', W0_FRI, 780, 840, '점심', 'lunch'),
    ev('sehun-w0-5', W0_FRI, 840, 960, '성능 리뷰', 'meeting'),

    // ── 다음 주(next-week) : S2 ──
    // Mon : 오전 채움 → 불참
    ev('sehun-w1-1', W1_MON, 600, 780, '배포 점검', 'meeting'),
    ev('sehun-w1-l1', W1_MON, 780, 840, '점심', 'lunch'),
    // Tue : 오전 채움, 13:00 점심 후 14:00 슬롯만 온전히 비움 → 화 14:00 에 after-lunch(세훈)
    ev('sehun-w1-2', W1_TUE, 600, 780, '인프라 점검', 'meeting'),
    ev('sehun-w1-l2', W1_TUE, 780, 840, '점심', 'lunch'),
    ev('sehun-w1-2b', W1_TUE, 900, 1080, '용량 산정', 'meeting'),
    // Wed : 10:00 슬롯만 온전히 비움(11:30 부터 채움 — 별 슬롯에 back-to-back 남기지 않음). 11:30~15:00 리뷰라 점심 없음.
    ev('sehun-w1-3', W1_WED, 690, 900, '아키텍처 리뷰', 'meeting'),
    // Thu : 오전 채움 → 불참
    ev('sehun-w1-4', W1_THU, 600, 780, '장애 회고', 'meeting'),
    ev('sehun-w1-l4', W1_THU, 780, 840, '점심', 'lunch'),
    // Fri : 오전 채움 → 불참
    ev('sehun-w1-5', W1_FRI, 600, 780, '성능 리뷰', 'meeting'),
    ev('sehun-w1-l5', W1_FRI, 780, 840, '점심', 'lunch'),

    // ── flexible ──
    ev('sehun-w2-l1', W2_MON, 780, 840, '점심', 'lunch'),
    ev('sehun-w2-1', W2_MON, 600, 720, '배포 점검', 'meeting'),
  ],
};

// ── 나머지 14인 (정품질 인물 풀) ─────────────────────────────
// 각자 서로 다른 근무 리듬·패턴을 갖되, S1~S4 랭킹에는 관여하지 않는다(기본 캐스트 밖).
// 계약: 전원 workHours 보유 · next-week 창에 이벤트 ≥5 · headline(외근 종일 또는 점심 리듬) 보유.
// 점심은 자율 — 사람마다 다른 시각(11:00~13:45 시작), 60~90분. 겹치는 요일은 거른다(buildExtra).

interface ExtraSpec {
  id: string; name: string; role: string; faceId: string;
  workHours: { start: number; end: number };
  /**
   * 자율 점심(start,end) — 사람마다 다른 시각·60~90분. 리듬/헤드라인 소스.
   * 그날 하드 일정(미팅·외근)과 겹치는 요일은 점심을 거른다(buildExtra 가드) —
   * 남는 날들이 같은 쌍이므로 lunchRhythm(최빈 쌍)은 그대로 이 튜플이다.
   */
  lunch: [number, number];
  /** 주간 반복 미팅: [요일(0=월..4=금), start, end, title] */
  meetings: Array<[number, number, number, string]>;
  /** 종일급 외근 요일(있으면 그 요일 헤드라인). [weekday, start, end, title] */
  offsite?: [number, number, number, string];
  /** 집중시간(soft). [weekday, start, end, title] */
  focus?: [number, number, number, string];
}

const WEEKDAY_DATES: Record<number, [string, string, string]> = {
  0: [W0_MON, W1_MON, W2_MON],
  1: [W0_TUE, W1_TUE, W2_TUE],
  2: [W0_WED, W1_WED, W2_WED],
  3: [W0_THU, W1_THU, W2_THU],
  4: [W0_FRI, W1_FRI, W2_FRI],
};

/** ExtraSpec → Person. 세 주(현재·다음·flexible) 전부에 패턴을 펼친다. */
function buildExtra(s: ExtraSpec): Person {
  const events: CalendarEvent[] = [];
  const weekdays = [0, 1, 2, 3, 4];
  for (const wd of weekdays) {
    const [d0, d1, d2] = WEEKDAY_DATES[wd];
    for (const [wi, day] of [d0, d1, d2].entries()) {
      // 그날의 하드 일정(미팅·외근) — 점심 가드의 근거.
      const hard: Array<{ start: number; end: number }> = [];
      // 반복 미팅(해당 요일)
      for (const [mwd, ms, me, title] of s.meetings) {
        if (mwd === wd) {
          events.push(ev(`${s.id}-m-${mwd}-${ms}-${wi}`, day, ms, me, title, 'meeting'));
          hard.push({ start: ms, end: me });
        }
      }
      // 외근
      if (s.offsite && s.offsite[0] === wd) {
        events.push(ev(`${s.id}-o-${wd}-${wi}`, day, s.offsite[1], s.offsite[2], s.offsite[3], 'offsite'));
        hard.push({ start: s.offsite[1], end: s.offsite[2] });
      }
      // 집중(soft — 점심 가드 대상 아님)
      if (s.focus && s.focus[0] === wd) {
        events.push(ev(`${s.id}-f-${wd}-${wi}`, day, s.focus[1], s.focus[2], s.focus[3], 'focus'));
      }
      // 자율 점심 — 하드 일정과 겹치는 날은 거른다(그날은 점심을 못 챙긴 날).
      const clash = hard.some((h) => s.lunch[0] < h.end && h.start < s.lunch[1]);
      if (!clash) {
        events.push(ev(`${s.id}-l-${wd}-${wi}`, day, s.lunch[0], s.lunch[1], '점심', 'lunch'));
      }
    }
  }
  return { id: s.id, name: s.name, role: s.role, faceId: s.faceId, workHours: s.workHours, events };
}

const EXTRA_SPECS: ExtraSpec[] = [
  // 2 offsite-요일 people (코어와 다른 요일: 수·금)
  {
    id: 'jiwoo', name: '서지우', role: 'Sales Manager', faceId: 'jiwoo',
    workHours: { start: 540, end: 1080 }, lunch: [785, 875],
    offsite: [2, 540, 900, '외근 — 고객사 미팅'],
    meetings: [[0, 660, 780, '세일즈 파이프라인 리뷰'], [4, 600, 720, '위클리 세일즈 싱크']],
  },
  {
    id: 'daon', name: '정다온', role: 'CX Manager', faceId: 'daon',
    workHours: { start: 540, end: 1080 }, lunch: [795, 855],
    offsite: [4, 540, 900, '외근 — VOC 현장 방문'],
    meetings: [[1, 660, 780, 'CX 주간 리뷰'], [2, 900, 1020, '보이스 오브 커스터머']],
  },
  // 3 recurring-meeting people (점심 리듬으로 헤드라인)
  {
    id: 'yerin', name: '신예린', role: 'Product Manager', faceId: 'yerin',
    workHours: { start: 540, end: 1080 }, lunch: [765, 825],
    meetings: [[0, 600, 720, '제품 기획 정례'], [1, 900, 1020, '로드맵 리뷰'], [2, 660, 780, '스프린트 그루밍'], [3, 840, 960, '이해관계자 싱크'], [4, 600, 720, '위클리 랩업']],
  },
  {
    id: 'taeyang', name: '문태양', role: 'Android Engineer', faceId: 'taeyang',
    workHours: { start: 540, end: 1080 }, lunch: [750, 840],
    meetings: [[0, 600, 720, '안드로이드 스탠드업'], [2, 660, 780, '릴리즈 회고'], [3, 600, 720, '코드 리뷰 타임']],
  },
  {
    id: 'onyu', name: '최온유', role: 'Legal Counsel', faceId: 'onyu',
    workHours: { start: 540, end: 1080 }, lunch: [755, 830],
    meetings: [[1, 630, 750, '계약 검토 미팅'], [3, 900, 1020, '심의 회의']],
  },
  // 3 lunch-rhythm people (11:00 / 12:20 / 13:30 — 이른·보통·늦은 점심)
  {
    id: 'saebom', name: '윤새봄', role: 'UX Writer', faceId: 'saebom',
    workHours: { start: 540, end: 1080 }, lunch: [660, 735],
    meetings: [[1, 840, 960, '카피 리뷰'], [3, 660, 780, '보이스 톤 워크숍'], [4, 600, 660, '릴리즈 노트']],
  },
  {
    id: 'sujin', name: '강수진', role: 'QA Engineer', faceId: 'sujin',
    workHours: { start: 540, end: 1080 }, lunch: [740, 815],
    meetings: [[0, 840, 960, '스프린트 테스트 계획'], [2, 600, 720, 'QA 위클리'], [4, 900, 1020, '릴리즈 리그레션']],
  },
  {
    id: 'soyul', name: '박소율', role: 'Content Marketer', faceId: 'soyul',
    workHours: { start: 540, end: 1080 }, lunch: [810, 870],
    meetings: [[1, 600, 720, '콘텐츠 기획'], [3, 660, 780, '콘텐츠 편집 회의'], [4, 840, 960, '발행 점검']],
  },
  // 2 early-birds (workHours 480~1020)
  {
    id: 'hangyeol', name: '이한결', role: 'Data Engineer', faceId: 'hangyeol',
    workHours: { start: 480, end: 1020 }, lunch: [725, 815],
    focus: [4, 480, 600, '집중 작업 — 배치 마이그레이션'],
    meetings: [[0, 540, 660, '데이터 파이프라인 점검'], [2, 600, 720, '스키마 리뷰']],
  },
  {
    id: 'yeonghun', name: '조영훈', role: 'Server Engineer', faceId: 'yeonghun',
    workHours: { start: 480, end: 1020 }, lunch: [675, 750],
    meetings: [[0, 540, 660, '서버 정기 점검'], [1, 840, 960, '인프라 리뷰'], [3, 630, 750, '용량 계획']],
  },
  // 2 flexible (workHours 600~1140)
  {
    id: 'gaon', name: '임가온', role: 'Brand Designer', faceId: 'gaon',
    workHours: { start: 600, end: 1140 }, lunch: [825, 900],
    focus: [3, 600, 720, '집중 작업 — 로고 시안'],
    meetings: [[1, 660, 780, '브랜드 리뷰'], [4, 960, 1080, '크리에이티브 싱크']],
  },
  {
    id: 'eunchae', name: '오은채', role: 'Finance Manager', faceId: 'eunchae',
    workHours: { start: 600, end: 1140 }, lunch: [790, 850],
    meetings: [[0, 900, 1020, '월 결산 준비'], [2, 840, 960, '예산 리뷰'], [4, 660, 780, '정산 점검']],
  },
  // 2 busy-dense
  {
    id: 'doyun', name: '한도윤', role: 'iOS Engineer', faceId: 'doyun',
    workHours: { start: 540, end: 1080 }, lunch: [730, 790],
    meetings: [[0, 600, 720, 'iOS 스탠드업'], [1, 780, 900, '빌드 점검'], [2, 600, 720, '릴리즈 트레인'], [3, 840, 960, '크래시 리뷰'], [4, 660, 780, '주간 회고']],
  },
  {
    id: 'bada', name: '김바다', role: 'Business Developer', faceId: 'bada',
    workHours: { start: 540, end: 1080 }, lunch: [745, 820],
    meetings: [[0, 840, 960, '사업 검토'], [1, 600, 720, '제휴 협상'], [2, 900, 1020, '파트너 리뷰'], [3, 660, 780, '딜 파이프라인'], [4, 840, 960, '주간 사업 싱크']],
  },
];

export const ORG: Person[] = [
  ichan, junho, seoyeon, minsu, haneul, sehun,
  ...EXTRA_SPECS.map(buildExtra),
];

// ── 회의실 4개 ─────────────────────────────────────────────
// 정원 4/8/10/2. 일부 점유 일정으로 슬롯마다 가용성이 달라진다.
// (Wed 7/15 10:00~11:00 은 큰 방(미팅룸2·5)을 비워 별 슬롯이 no-room 을 받지 않게 한다.)
export const ROOMS: Room[] = [
  {
    id: 'room-1', name: '미팅룸 1', capacity: 4, floorNote: '3층',
    events: [
      { day: W1_MON, start: 600, end: 720 }, { day: W1_WED, start: 780, end: 900 },
      { day: W1_THU, start: 660, end: 780 }, { day: W1_FRI, start: 600, end: 720 },
    ],
  },
  {
    id: 'room-2', name: '미팅룸 2', capacity: 8, floorNote: '3층',
    events: [
      { day: W1_MON, start: 810, end: 960 }, { day: W1_TUE, start: 600, end: 720 },
      { day: W1_THU, start: 780, end: 900 }, { day: W1_FRI, start: 900, end: 1020 },
    ],
  },
  {
    id: 'room-5', name: '미팅룸 5', capacity: 10, floorNote: '4층',
    events: [
      { day: W1_MON, start: 900, end: 1080 }, { day: W1_TUE, start: 660, end: 840 },
      { day: W1_WED, start: 780, end: 900 }, { day: W1_THU, start: 900, end: 1050 },
    ],
  },
  {
    id: 'room-focus', name: '포커스룸', capacity: 2, floorNote: '3층',
    events: [
      { day: W1_WED, start: 600, end: 720 }, { day: W1_THU, start: 660, end: 780 },
    ],
  },
];

// ── S5: 수신 초대 ──────────────────────────────────────────
// 최민수 → 나. 받는 사람(나) 관점의 해요체. 내 줄(회원님)이 첫 줄.
// 코드값은 SlotReason 재사용, 세계 사실과 모순 없게 손으로 쓴다.
// attendeeCount는 각본 수치(민수가 잡은 회의의 전체 인원) — 초대 카드 헤드라인이 그대로 쓴다.
export const INCOMING_INVITE: {
  fromId: string; title: string; day: string; start: number; end: number;
  attendeeCount: number; reasonsForMe: SlotReason[];
} = {
  fromId: 'minsu',
  title: '디자인 시스템 리뷰',
  day: W0_THU, // 목 7/9 14:00~15:00
  start: 840,
  end: 900,
  attendeeCount: 5,
  reasonsForMe: [
    { code: 'all-required-ok', tone: 'positive', text: '회원님의 금요일 마감 회의를 피했어요' },
    { code: 'optional-ok', tone: 'positive', text: '점심 이후라 오후 흐름에 자연스럽게 이어져요' },
    { code: 'offsite-day', tone: 'warning', text: '박준호님은 이날 외근이라 화상으로 합류해요' },
  ],
};

// ── S6: 응답 각본 ──────────────────────────────────────────
export const RESPONSE_SCRIPT: {
  afterMs: number; personId: string; kind: 'accepted' | 'partial' | 'difficult'; text: string;
}[] = [
  { afterMs: 3000, personId: 'junho', kind: 'accepted', text: '준호님이 참석해요' },
  { afterMs: 6000, personId: 'seoyeon', kind: 'accepted', text: '서연님이 참석해요' },
  { afterMs: 10000, personId: 'haneul', kind: 'partial', text: '하늘님이 앞 30분 함께해요' },
];

// ── 참석자 구성 헬퍼 ───────────────────────────────────────
/**
 * id 목록 → Attendee[]. 주최자는 isOrganizer, 나머지는 required/optional 로 표시한다.
 * 순서: required 먼저(주최자 맨 앞), 그다음 optional — UI/테스트가 그대로 쓴다.
 */
export function castAsAttendees(args: {
  requiredIds: string[]; optionalIds?: string[]; organizerId?: string;
}): Attendee[] {
  const { requiredIds, optionalIds = [], organizerId = ME_ID } = args;
  const byId = new Map(ORG.map((p) => [p.id, p]));
  const pick = (id: string, attendanceType: 'required' | 'optional'): Attendee => {
    const p = byId.get(id);
    if (!p) throw new Error(`castAsAttendees: unknown id ${id}`);
    return { ...p, attendanceType, ...(id === organizerId ? { isOrganizer: true } : {}) };
  };
  return [
    ...requiredIds.map((id) => pick(id, 'required')),
    ...optionalIds.map((id) => pick(id, 'optional')),
  ];
}

/** S1~S4 기본 캐스트(6인): 필수 4 + 선택 2(하늘·세훈). */
export const DEFAULT_CAST: { requiredIds: string[]; optionalIds: string[] } = {
  requiredIds: ['ichan', 'junho', 'seoyeon', 'minsu'],
  optionalIds: ['haneul', 'sehun'],
};
