import type { Minutes } from './time';

export type AttendanceType = 'required' | 'optional';
export type EventKind = 'meeting' | 'focus' | 'offsite' | 'lunch' | 'personal';
export interface CalendarEvent { id: string; day: string; start: Minutes; end: Minutes; title: string; kind: EventKind; room?: string; }
export interface Person {
  id: string; name: string; role: string; faceId: string;
  workHours: { start: Minutes; end: Minutes };
  events: CalendarEvent[];                    // 데모 전 기간(7/1~7/24)
}
export interface Attendee extends Person { attendanceType: AttendanceType; isOrganizer?: boolean; }
export type DeadlineKind = 'this-week' | 'next-week' | 'flexible';
export interface Rules { days: string[]; durationMinutes: number; deadline: DeadlineKind; }
export type ReasonCode =
  | 'all-required-ok' | 'optional-ok' | 'optional-partial' | 'optional-unavailable'
  | 'after-lunch' | 'lunch-squeeze' | 'offsite-day' | 'back-to-back'
  | 'focus-overlap' | 'late-start' | 'no-room' | 'before-lunch-bonus';
export interface ScoreEffect { code: ReasonCode; delta: number; who?: string; data?: Record<string, string | number>; }
export type ReasonTone = 'positive' | 'tradeoff' | 'warning';
export interface SlotReason { code: ReasonCode; tone: ReasonTone; text: string; who?: string; }
export interface PartialInfo { attendeeId: string; part: 'front' | 'back'; minutes: Minutes; conflictTitle: string; }
export interface CandidateSlot {
  id: string; day: string; start: Minutes; end: Minutes;
  score: number; reasons: SlotReason[]; partials: PartialInfo[];
  severity: 'good' | 'tradeoff' | 'warning'; roomIds: string[];
}
export interface Room { id: string; name: string; capacity: number; floorNote: string; events: { day: string; start: Minutes; end: Minutes }[]; }
export interface LunchRhythm { start: Minutes; end: Minutes }
export interface PersonInsights {
  offsiteWeekdays: number[];                                  // 빈도 ≥2 요일
  recurring: { weekday: number; start: Minutes; title: string }[]; // 주 2회 이상 반복
  lunchRhythm: LunchRhythm | null;
  headline: string | null;                                    // 피크 각주 문장
  scanLine: string;                                           // 스캔 모먼트 문장
}
export type NotificationKind = 'response' | 'invite' | 'confirmed';
export interface AppNotification { id: string; kind: NotificationKind; personId?: string; text: string; at: number; transient?: boolean; } // at = 도착 시각(epoch ms) — 알림 센터 상대시간의 근거. transient = 자기 행동 피드백: 토스트로만 살고 알림 센터·배지에 안 남는다.
