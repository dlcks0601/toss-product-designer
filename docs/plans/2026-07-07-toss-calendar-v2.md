# toss calendar v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토스 프로덕트 디자이너 챌린지 2026 제출작 — "사람을 읽는 캘린더" 웹앱(PC+모바일)을 오늘(2026-07-07) 안에 전체 빌드하고 Vercel에 배포한다.

**Architecture:** 순수 함수 스케줄링 엔진(v1 이식+8단계 확장, `src/lib`)과 결정적 목데이터 각본(`src/data`) 위에, reducer 스텝 머신이 오케스트레이션하는 단일 페이지 클라이언트 앱. 화면은 여정 A(회의 잡기)와 여정 B(초대 응답)로 구성되고 알림 스토어가 둘을 잇는다.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind v4(CSS-first `@theme`) + motion(framer-motion 후속) + lucide-react + vitest. 배포는 Vercel.

**스펙(단일 진실 소스):** `docs/superpowers/specs/2026-07-07-toss-calendar-v2-design.md` — 이 계획과 함께 v2 레포로 복사됨. 모든 태스크는 스펙의 해당 섹션을 먼저 읽고 시작한다.

## Global Constraints

- 새 레포: `/Users/leechan/leechan/toss-calendar`. 커밋은 의미 단위(심사자가 읽는 산출물).
- **결정적 세계**: `Date.now()`/`new Date()`(인자 없음)/`Math.random()` 사용 금지. `ANCHOR_DATE = '2026-07-07'`(화), 이번 주 = 7/6~7/10, 다음 주 = 7/13~7/17, 여유 창 = ~7/24.
- **엔진 계약**: 모든 점수 변화에 이유 페어링. 점수 UI 노출 금지. 이유 문장은 감정 언어 금지(관찰된 패턴의 언어), 해요체.
- **성능 철칙**: 애니메이션은 `transform`/`opacity`만. 대면적 CSS `blur()` 애니메이션 금지. 리스트 아이템 `React.memo` + 파생 배열 `useMemo` + 안정 key.
- **모션 토큰**(토스 실측): press-in 120ms `scale(0.96)` / press-out 320ms `cubic-bezier(0.4,0,0.2,1)` / reveal `opacity+blur(12px)+translateY(24px)` 800·900ms `cubic-bezier(0.16,1,0.3,1)` 스태거 60~80ms / 배경 `cubic-bezier(0.6,0,0,0.6)`. motion 스프링 2종: 제자리 팝 `{stiffness:500,damping:18}`(스케일 전용) / 위치 이동 `{stiffness:350,damping:30}`(오버슈트 금지).
- **컬러 토큰**: primary `#3182F6` / pressed `#1B64DA` / tint `#E8F3FF` / text `#191F28`·`#4E5968`·`#8B95A1` / border `#E5E8EB` / section `#F2F4F6` / error `#F04452` / warn-fg `#B45309`. 라이트 모드만.
- **폰트**: `https://static.toss.im/tps/main.css`+`others.css`(Toss Product Sans, UI 전체) + `/fonts/TossDisplaySansVariable.ttf` 셀프호스팅(워드마크·디스플레이). v1 `src/app/layout.tsx` 방식 그대로.
- **UX 라이팅**: 해요체·능동태·동사구 CTA. 예: "이 시간으로 할게요", "시간 찾아보기".
- `prefers-reduced-motion`: 스캔 모먼트 생략(+aria-live), FLIP·스태거·오로라 애니메이션 끔.
- v1 참조 규칙: `src/lib`·`src/data`·설정 파일은 자유 참조. v1 UI 컴포넌트는 해당 화면 구현이 끝난 뒤 접근성 디테일 선별 이식 시에만 열람.
- 테스트: vitest. 엔진·데이터 태스크는 TDD(실패 확인 → 구현 → 통과 확인 → 커밋).

**v1 경로**: `/Users/leechan/leechan/Product-Designer-Challenge-2026` (이하 `V1/`)

---

### Task 1: 레포 스캐폴드

**Files:**
- Create: `/Users/leechan/leechan/toss-calendar/` 전체 (package.json, next.config.ts, tsconfig.json, postcss.config.mjs, vitest.config.ts, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, public/fonts/, docs/)

**Interfaces:**
- Produces: 이후 모든 태스크의 작업 환경. `npm run dev`(포트 자유)·`npm test` 동작. globals.css의 `@theme` 토큰 이름들(`--color-primary`, `--color-text-strong` 등 아래 명세).

- [ ] **Step 1: 스캐폴드 복제** — v1의 검증된 설정을 재사용한다:

```bash
mkdir -p /Users/leechan/leechan/toss-calendar && cd /Users/leechan/leechan/toss-calendar
git init
# v1에서 설정/에셋 복사 (node_modules, .next, src 제외)
cp V1/package.json V1/tsconfig.json V1/next.config.ts V1/postcss.config.mjs V1/vitest.config.ts .
cp -r V1/public .
mkdir -p src/app src/lib src/data src/components src/app-state docs/specs docs/plans
cp V1/docs/superpowers/specs/2026-07-07-toss-calendar-v2-design.md docs/specs/
cp V1/docs/superpowers/plans/2026-07-07-toss-calendar-v2.md docs/plans/
```

package.json에서 `name`을 `"toss-calendar"`로 수정. `.gitignore`는 v1 것 복사(+`.superpowers/` 추가).

- [ ] **Step 2: layout.tsx 작성** — v1 `V1/src/app/layout.tsx`의 폰트 로딩(TPS CDN 2종 + Display Sans preload) 그대로, 메타데이터만 교체:

```tsx
export const metadata: Metadata = {
  title: 'toss calendar — 모두를 생각한 시간',
  description: '동료들의 상황을 읽고, 모두가 괜찮은 시간을 찾아드려요',
};
```

- [ ] **Step 3: globals.css 토큰 정의** — Tailwind v4 `@theme` 블록. Global Constraints의 컬러 전부 + 모션 커스텀 프로퍼티:

```css
@import 'tailwindcss';
@theme {
  --color-primary: #3182f6;
  --color-primary-pressed: #1b64da;
  --color-primary-tint: #e8f3ff;
  --color-bg: #ffffff;
  --color-section: #f2f4f6;
  --color-border: #e5e8eb;
  --color-text-strong: #191f28;
  --color-text-body: #4e5968;
  --color-text-weak: #8b95a1;
  --color-text-faint: #b0b8c1;
  --color-error: #f04452;
  --color-warn-fg: #b45309;
  --color-warn-bg: #fff9e7;
  --radius-card: 16px;
}
:root {
  --bezier-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --bezier-out: cubic-bezier(0.25, 0.1, 0.25, 1);
  --bezier-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --bezier-back: cubic-bezier(0.34, 1.56, 0.64, 1);
  --bezier-ambient: cubic-bezier(0.6, 0, 0, 0.6);
}
@font-face { /* v1 globals.css의 Toss Display Sans Variable 선언 복사 */ }
body { font-family: 'Toss Product Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
.font-display { font-family: 'Toss Display Sans Variable', 'Toss Display Sans', -apple-system, sans-serif; }
/* 프레스 스쿼시 — 전 버튼·칩 공용 */
.pressable { transition: transform 320ms var(--bezier-standard), background-color 320ms var(--bezier-standard); }
.pressable:active { transform: scale(0.96); transition-duration: 120ms; }
@media (prefers-reduced-motion: reduce) { .pressable, .pressable:active { transform: none; } }
```

- [ ] **Step 4: page.tsx 임시 확인 페이지** — 워드마크 텍스트+토큰 적용 확인용 한 줄. `npm install && npm run dev` 후 브라우저에서 폰트·색 렌더 확인. `npm test`가 "no tests"로 정상 종료 확인.

- [ ] **Step 5: Commit** — `chore: scaffold — v1 설정·폰트·토큰 이식`

---

### Task 2: 공용 시간 유틸 `time.ts` (엔진 1단계)

**Files:**
- Create: `src/lib/time.ts`, `src/lib/time.test.ts`

**Interfaces:**
- Produces (이후 전 엔진 태스크가 사용):

```ts
export type Minutes = number; // 자정 기준 분
export function overlaps(aS: Minutes, aE: Minutes, bS: Minutes, bE: Minutes): boolean; // 경계 접촉은 false
export function weekdayIndex(isoDate: string): number;   // 0=월 … 6=일, UTC 기준
export function isBusinessDay(isoDate: string): boolean; // 월~금
export function addDaysISO(isoDate: string, n: number): string; // UTC 기준
export function businessDaysFrom(isoDate: string, count: number): string[]; // 다음 영업일 count개(당일 제외)
export function fmtTime(m: Minutes): string;  // 690 → '오전 11:30'
export function fmtRange(s: Minutes, e: Minutes): string;
export function fmtDayKorean(isoDate: string): string; // '7월 13일 (월)' — UTC 기준(v1 format.ts의 로컬 파싱을 UTC로 교정)
```

- [ ] **Step 1: 실패 테스트 작성** — v1 `V1/src/lib/scheduler.test.ts`의 overlaps 경계 케이스 + 신규:

```ts
import { describe, it, expect } from 'vitest';
import { overlaps, weekdayIndex, businessDaysFrom, fmtTime, fmtDayKorean } from './time';

describe('time', () => {
  it('경계 접촉은 겹침이 아니다', () => { expect(overlaps(600, 660, 660, 720)).toBe(false); });
  it('부분 겹침', () => { expect(overlaps(600, 660, 630, 690)).toBe(true); });
  it('weekdayIndex는 UTC 기준 — 2026-07-06은 월(0), 07-12는 일(6)', () => {
    expect(weekdayIndex('2026-07-06')).toBe(0);
    expect(weekdayIndex('2026-07-12')).toBe(6);
  });
  it('businessDaysFrom은 주말을 건너뛴다 — 금요일 다음 2영업일은 월·화', () => {
    expect(businessDaysFrom('2026-07-10', 2)).toEqual(['2026-07-13', '2026-07-14']);
  });
  it('fmtTime', () => { expect(fmtTime(690)).toBe('오전 11:30'); expect(fmtTime(840)).toBe('오후 2:00'); });
  it('fmtDayKorean은 UTC 기준', () => { expect(fmtDayKorean('2026-07-13')).toBe('7월 13일 (월)'); });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/time.test.ts` → FAIL(모듈 없음)
- [ ] **Step 3: 구현** — v1 `scheduler.ts:31-45`의 overlaps/weekdayIndex, `relaxation.ts:19-44`의 date 유틸, `format.ts`의 포매터를 **UTC 통일**로 병합 구현(`new Date(iso + 'T00:00:00Z')`만 사용).
- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/time.test.ts` → PASS
- [ ] **Step 5: Commit** — `feat(engine): 공용 시간 유틸 — UTC 통일, 3중 복제 해소`

---

### Task 3: 도메인 타입 `types.ts`

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces (전 태스크 공용 — 정확히 이 이름·형태):

```ts
import type { Minutes } from './time';

export type AttendanceType = 'required' | 'optional';
export type EventKind = 'meeting' | 'focus' | 'offsite' | 'lunch' | 'personal';
export interface CalendarEvent { id: string; day: string; start: Minutes; end: Minutes; title: string; kind: EventKind; }
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
export interface AppNotification { id: string; kind: NotificationKind; personId?: string; text: string; at: number; } // at = 데모 내 상대 ms
```

- [ ] **Step 1: 파일 작성** (위 그대로) → `npx tsc --noEmit`로 타입 체크 통과 확인
- [ ] **Step 2: Commit** — `feat(engine): v2 도메인 타입`

---

### Task 4: 스코어 규칙·이유 포매터·rankSlots (엔진 2단계 + 결함 수정)

**Files:**
- Create: `src/lib/scoring.ts`, `src/lib/reasons.ts`, `src/lib/scheduler.ts`, 각 `.test.ts`
- 참조: `V1/src/lib/scheduler.ts` (골격), `V1/src/lib/scheduler.test.ts` (테스트 이식)

**Interfaces:**
- Produces:

```ts
// scoring.ts — 순수 점수 규칙. 한국어 문장 없음.
export const SCORING = { optionalOk: 10, optionalPartial: 5, beforeLunch: 4, afterLunch: -12, lunchSqueeze: -8, offsite: -8, backToBack: -6, focusOverlap: -5, lateStart: -4, noRoom: -7 } as const;
export function scoreSlot(args: { day: string; start: Minutes; end: Minutes; attendees: Attendee[]; insights: Record<string, PersonInsights>; rooms: Room[] }): { effects: ScoreEffect[]; partials: PartialInfo[]; roomIds: string[] };
// reasons.ts — 코드→해요체 문장. UI·수신자 관점 재사용.
export function formatReasons(effects: ScoreEffect[], attendees: Attendee[]): SlotReason[];
export function summarizeSlot(reasons: SlotReason[], requiredCount: number): string; // 카드 1줄 요약
// scheduler.ts
export function rankSlots(args: { attendees: Attendee[]; rules: Rules; rooms: Room[]; insights: Record<string, PersonInsights> }): CandidateSlot[];
export function needsDecisionMoment(visibleSlots: CandidateSlot[]): boolean; // 표시 후보 기준(결함⑤ 수정)
```

- [ ] **Step 1: v1 테스트 이식·확장 실패 확인** — `V1/src/lib/scheduler.test.ts`의 하드필터 3종·tie-break·정렬 테스트를 새 시그니처로 이식하고, 결함 수정 검증 테스트를 추가:

```ts
it('선택 가능자 가점은 인원 스케일에 눌리지 않는다 — 선택 5명 가점 총합이 warning 하나(-12)를 못 이긴다', () => {
  // 결함① 정규화: optionalOk 가점은 선택 인원수로 평균(총합 최대 +10)
});
it('back-to-back은 직전·직후 양방향 모두 effects에 남는다', () => { /* 결함③ */ });
it('rules.days에 주말이 섞여도 슬롯을 만들지 않는다', () => { /* 결함⑥ */ });
it('점심 직전 보너스는 duration 기준 상대 계산 — 30분 회의도 진짜 직전 슬롯이 받는다', () => { /* 결함⑧ */ });
it('필수 근무시간 교집합이 비면 빈 배열, 예외 없음', () => {});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현** — v1 rankSlots 골격(교집합 프레임→30분 스텝→하드필터→소프트 정렬) 이식하되: scoreSlot은 `ScoreEffect[]` 반환(카피 제로), 정규화(`optionalOk`는 `Math.round(10 * okCount / optionalCount)` 1회), 주말 가드, 매직넘버를 duration 상대 계산으로, urgent 완전 제거, `needsDecisionMoment(visibleSlots)`는 호출부가 상위 N개만 넘김. 점심·부분참석 규칙 자리는 이 태스크에선 스텁(빈 effects) — Task 5·6에서 채움.
- [ ] **Step 4: 통과 확인** → PASS (이식 테스트 + 신규 전부)
- [ ] **Step 5: reasons.ts 테스트→구현** — 코드별 문장 계약(감정 언어 금지):

```ts
it('optional-partial → "하늘님은 앞 30분만 함께할 수 있어요 — 11시에 다른 회의"', () => {});
it('all-required-ok는 인원 합산 한 줄 — "필수 4명 모두 편하게 참석할 수 있어요"', () => {});
```

- [ ] **Step 6: Commit** — `feat(engine): rankSlots 이식 — 점수·카피 분리, 정규화, 결함 수정`

---

### Task 5: 점심 리듬·점심 보호 `lunch.ts` (엔진 4단계)

**Files:**
- Create: `src/lib/lunch.ts`, `src/lib/lunch.test.ts`
- Modify: `src/lib/scoring.ts` (스텁 교체 — lunch effects 통합)

**Interfaces:**
- Produces:

```ts
export function afterLunchEffect(person: Attendee, rhythm: LunchRhythm | null, slotStart: Minutes): ScoreEffect | null;
// rhythm 있고 slotStart ∈ [rhythm.end, rhythm.end+30) → { code:'after-lunch', delta:-12, who }
export function lunchSqueezeEffect(person: Attendee, day: string, slot: {start:Minutes; end:Minutes}): ScoreEffect | null;
// 슬롯이 11:00~15:00(660~900)과 겹칠 때: 그날 events+슬롯 배치 후 660~900 내 최장 연속 빈 구간 < 60 → { code:'lunch-squeeze', delta:-8, who, data:{gap} }
```

- [ ] **Step 1: 실패 테스트** —

```ts
it('리듬 13:00~13:40인 사람: 13:40~14:10 시작은 감점, 14:10 이후는 무감점', () => {});
it('리듬 null이면 after-lunch 없음 — 예측하지 않는다', () => {});
it('오후가 꽉 찬 사람: 11~12시 회의가 들어가면 점심 여유 30분 → lunch-squeeze', () => {});
it('여유 60분 이상 남으면 침묵', () => {});
it('S2 재현: 세훈(리듬 13:00) 화 14:00 시작 → after-lunch + 완화 데이터(10분 늦추기 가능)', () => {});
```

- [ ] **Step 2: 실패 확인** → FAIL / **Step 3: 구현** (경계: 겹침·빈구간 계산에 Task 2 `overlaps` 재사용) / **Step 4: 통과** → PASS
- [ ] **Step 5: scoring.ts 스텁 교체 후 전체 엔진 테스트 재실행** — `npx vitest run src/lib` → PASS
- [ ] **Step 6: Commit** — `feat(engine): 개인 점심 리듬 + 점심 보호 — 고정 점심 폐기`

---

### Task 6: 부분 참석 `partial.ts` (엔진 5단계)

**Files:**
- Create: `src/lib/partial.ts`, `src/lib/partial.test.ts`
- Modify: `src/lib/scoring.ts` (선택 참석자 이진 판정 교체)

**Interfaces:**
- Produces:

```ts
export type PartialResult = { kind: 'full' } | { kind: 'partial'; info: PartialInfo } | { kind: 'none'; conflictTitle: string };
export function partialAvailability(person: Attendee, day: string, slot: {start:Minutes; end:Minutes}): PartialResult;
// 겹침이 슬롯 앞/뒤 한쪽에만 있고 남는 연속 구간 ≥ 슬롯의 절반 → partial(front|back, minutes)
```

- [ ] **Step 1: 실패 테스트** —

```ts
it('10~11시 슬롯, 10:30부터 다른 회의 → front 30분 partial', () => {});
it('앞뒤 양쪽 겹침(남는 구간 < 절반) → none', () => {});
it('겹침 없음 → full', () => {});
it('S1 재현: 하늘(수 11시 회의) 수 10:00 슬롯 → front 30분, effects에 optional-partial +5', () => {});
```

- [ ] **Step 2~4: FAIL 확인 → 구현 → PASS.** scoring.ts에서 선택 참석자 평가를 `partialAvailability`로 교체(full→optionalOk / partial→optionalPartial+PartialInfo / none→optional-unavailable). 필수 참석자는 여전히 하드필터(full 아니면 제외).
- [ ] **Step 5: Commit** — `feat(engine): 부분 참석 — 이진 가능/불가를 "이만큼은 돼요"로`

---

### Task 7: 기한 윈도우 `window.ts` + 완화 `relaxation.ts` (엔진 3·6단계)

**Files:**
- Create: `src/lib/window.ts`, `src/lib/relaxation.ts`, 각 `.test.ts`
- 참조: `V1/src/lib/relaxation.ts` (하네스 이식)

**Interfaces:**
- Produces:

```ts
// window.ts
export const ANCHOR_DATE = '2026-07-07';
export function windowFor(deadline: DeadlineKind, anchor?: string): string[];
// 'this-week' → anchor 다음날부터 이번 주 금요일까지 영업일 / 'next-week' → + 다음 주 전체 / 'flexible' → + 그 다음 주
// relaxation.ts — v1 하네스 이식 + 수정 + 신규 kind
export type RelaxationKind = 'extend-deadline' | 'shorten-meeting' | 'make-optional' | 'allow-partial-required';
export interface RelaxationSuggestion { kind: RelaxationKind; targetId?: string; label: string; resultSummary: string; opens: number; bestSlot: CandidateSlot | null; }
export function suggestRelaxations(args: { attendees; rules; rooms; insights }): RelaxationSuggestion[]; // 실제 시뮬레이션, 상위 2~3개
export function findBottleneck(args): { personId: string; eventTitle: string } | null; // 주최자 제외(결함⑦)
```

- [ ] **Step 1: 실패 테스트** —

```ts
it('windowFor: next-week는 7/8~7/10 + 7/13~7/17 — 주말·과거 없음', () => {});
it('완화 시뮬은 rooms를 통과시킨다 — 방 없는 시간을 "열렸다"고 말하지 않는다(결함②)', () => {});
it('extend-deadline의 label과 patch가 같은 창을 가리킨다(결함④)', () => {});
it('allow-partial-required: 준호 부분 참석 허용 시 열리는 슬롯 수와 bestSlot 계산(S4)', () => {});
it('findBottleneck는 주최자를 지목하지 않는다', () => {});
```

- [ ] **Step 2~4: FAIL → 구현(v1 patch→rank→best 하네스 재사용, allow-partial-required는 대상자를 optional로 강등하는 대신 partialAvailability 통과를 하드필터 예외로 허용하는 patch) → PASS**
- [ ] **Step 5: Commit** — `feat(engine): 기한 윈도우 + 완화 시뮬 — rooms 통과·허락제 부분 참석`

---

### Task 8: 패턴 추출기 `insights.ts` (엔진 7단계) + rooms/urlState 이식

**Files:**
- Create: `src/lib/insights.ts`, `src/lib/insights.test.ts`
- Create: `src/lib/rooms.ts`(v1 그대로 + overlaps import를 time.ts로), `src/lib/urlState.ts`(v1 이식, 새 상태 필드 반영)

**Interfaces:**
- Produces:

```ts
export function deriveInsights(person: Person, windowDays: string[]): PersonInsights;
// offsiteWeekdays: kind==='offsite' 이벤트가 창 내 같은 요일 2회↑
// recurring: 같은 요일+시각 meeting 2회↑ → { weekday, start, title }
// lunchRhythm: kind==='lunch' 이벤트들의 최빈 시작~종료 (없으면 null)
// headline: 우선순위 외근>반복>점심, 1문장. 예: '목요일 외근이 잦은 편이에요' / 없으면 null
// scanLine: '준호님의 외근 요일을 확인했어요' 류 — 스캔 모먼트가 사용, 항상 존재
export function deriveAllInsights(people: Person[], windowDays: string[]): Record<string, PersonInsights>;
```

- [ ] **Step 1: 실패 테스트** — 외근 2회/반복 회의/점심 최빈값/패턴 없는 사람(headline null, scanLine은 폴백 '일정을 확인했어요') 각 1케이스 + "한 소스 세 곳" 계약(피크 각주와 스캔 문장이 같은 추출 결과에서 파생).
- [ ] **Step 2~4: FAIL → 구현 → PASS** / rooms.ts·urlState.ts 이식 후 기존 테스트 통과 확인
- [ ] **Step 5: Commit** — `feat(engine): 패턴 추출기 — 피크·스캔·이유 칩의 단일 소스`

---

### Task 9: 목데이터 각본 `world.ts` + 장면 계약 (S1~S6)

**Files:**
- Create: `src/data/world.ts`, `src/data/world.test.ts`, `src/data/faces.ts`(v1 이식)

**Interfaces:**
- Produces:

```ts
export const ME_ID = 'ichan';
export const CORE_CAST: string[]; // 기본 6인 id
export const ORG: Person[];       // 20명 전원 정품질 (7/1~7/24 일정, 전원 근무리듬·패턴 분배)
export const ROOMS: Room[];       // 4개 (정원 4/6/8/10, 점유 일정 포함)
export const INCOMING_INVITE: { fromId: 'minsu'; title: string; day: string; start: Minutes; end: Minutes; reasonsForMe: SlotReason[] }; // S5
export const RESPONSE_SCRIPT: { afterMs: number; personId: string; kind: 'accepted'|'partial'|'difficult'; text: string }[]; // S6
```

- [ ] **Step 1: 장면 계약 테스트 먼저 작성** (스펙 §4 표를 그대로 계약으로):

```ts
const setup = () => rankSlots({ attendees: castAsAttendees(/* 6인, 하늘·세훈 선택 */), rules: { days: windowFor('next-week'), durationMinutes: 60, deadline: 'next-week' }, rooms: ROOMS, insights: deriveAllInsights(ORG, windowFor('next-week')) });
it('S1: 후보 6~12개, 1위는 수 7/15 10:00이고 하늘 front 30분 partial 포함', () => {});
it('S2: 화 7/14 14:00 슬롯에 세훈 after-lunch effect + 완화 데이터', () => {});
it('S3: 목 7/16 11:00 슬롯에 준호 offsite-day + 서연 lunch-squeeze', () => {});
it('S4: deadline this-week → 후보 0 → suggestRelaxations에 allow-partial-required(준호) 포함', () => {});
it('전원 패턴: ORG 20명 모두 workHours·주당 이벤트 5개↑, headline 또는 recurring 보유', () => {});
it('결정성: rankSlots 2회 호출 결과 동일', () => {});
```

- [ ] **Step 2: FAIL 확인 → Step 3: world.ts 작성** — v1 `V1/src/data/team.ts`의 recurring 팩토리 패턴 참조. 코어 6인은 스펙 §4 표의 단서 그대로(준호: 목 외근 2회+월 10시 스프린트 / 서연: 화·수 오전 focus+오후 빡빡 / 민수: workHours 600~1140 / 하늘: 화 외근+수 11시 회의 / 세훈: lunch 13:00~13:40 매일+촘촘). 나머지 14명은 외근 요일·정기 미팅·점심 리듬·얼리버드/유연근무를 겹치지 않게 분배. **계약이 통과할 때까지 데이터를 역설계로 조정**(엔진 수정 금지 — 데이터로만 맞춘다).
- [ ] **Step 4: PASS 확인 → Step 5: Commit** — `feat(data): 20명 정품질 세계 + S1~S6 장면 계약`

---

### Task 10: 앱 상태 reducer + 알림 스토어

**Files:**
- Create: `src/app-state/reducer.ts`, `src/app-state/reducer.test.ts`, `src/app-state/notifications.ts`

**Interfaces:**
- Produces:

```ts
export type Step = 'home' | 'setup' | 'find' | 'confirm' | 'done' | 'invite';
export interface AppState {
  step: Step; title: string; attendeeIds: string[]; required: Record<string, boolean>;
  duration: 30|60|90; deadline: DeadlineKind; selectedSlotId: string | null;
  allowPartialRequiredId: string | null; roomId: string | 'remote' | null;
  scanPlayed: boolean; welcomeDismissed: boolean; mitigations: { delayTen: boolean; fiftyMin: boolean };
  inviteResponded: 'accepted' | 'difficult' | null; confirmedAt: boolean;
}
export type Action = /* SET_STEP, SET_TITLE, TOGGLE_ATTENDEE, SET_REQUIRED, SET_DURATION, SET_DEADLINE, SELECT_SLOT, ALLOW_PARTIAL, SET_ROOM, PLAY_SCAN, DISMISS_WELCOME, TOGGLE_MITIGATION, RESPOND_INVITE, CONFIRM, RESET */;
export function reducer(s: AppState, a: Action): AppState;
export function useNotifications(): { list: AppNotification[]; toasts: AppNotification[]; push(n: AppNotification): void; dismiss(id: string): void; markAllRead(): void };
// 확정 시 RESPONSE_SCRIPT를 setTimeout 큐로 재생 → push
```

- [ ] **Step 1: reducer 실패 테스트** — 참석자 2인 이상이면 setup이 회의 모드(파생 셀렉터 `isMeeting(state)`), CONFIRM은 selectedSlotId 필수, 시나리오 전이(홈→셋업→find→confirm→done→홈) 등 6케이스.
- [ ] **Step 2~4: FAIL → 구현 → PASS** (urlState 연동: attendeeIds·deadline·duration·step 직렬화)
- [ ] **Step 5: Commit** — `feat(app): reducer 스텝 머신 + 알림 스토어`

---

### Task 11: UI 파운데이션 — Aurora·Wordmark·공용 컴포넌트

**Files:**
- Create: `src/components/Aurora.tsx`, `src/components/Wordmark.tsx`, `src/components/Avatar.tsx`, `src/components/Chip.tsx`, `src/components/Badge.tsx`, `src/components/Reveal.tsx`, `src/components/ToastStack.tsx`, `src/components/NotificationBell.tsx`

**Interfaces:**
- Produces: `<Aurora variant="home|scan|done" />`, `<Wordmark />`(v1 워드마크+심벌 그대로), `<Avatar person size onClick />`, `<Chip selected onClick>`, `<Badge tone="rec|ok|warn">`, `<Reveal delay>`(blur-rise 등장 래퍼), `<ToastStack toasts onDismiss />`, `<NotificationBell list />`

- [ ] **Step 1: Aurora 구현** — 토스 방식 그대로(스펙 §5). blur 필터 금지:

```tsx
// 3개 radial-gradient 레이어, transform만 12s/17s/23s alternate, --bezier-ambient
// rgba(80,213,255,.25) / rgba(255,220,200,.2) / rgba(200,230,255,.2)
// position:absolute inset:-20%, pointer-events:none, will-change:transform
// @media (prefers-reduced-motion: reduce) → animation:none
```

- [ ] **Step 2: Reveal 구현** — `opacity:0 + blur(12px) + translateY(24px)` → 800/900ms `--bezier-expo`, prop `delay`로 60~80ms 스태거. reduced-motion 시 즉시 표시.
- [ ] **Step 3: 나머지 공용 컴포넌트 구현** — 전 버튼·칩에 `.pressable`. Avatar는 v1 `faces.ts` 재사용. ToastStack: PC `fixed bottom-6 right-6` 스택(최대 3, 4초 자동 소멸, motion 위치 스프링), 모바일 `top-4` 드롭.
- [ ] **Step 4: 데모 페이지에서 육안 확인** — page.tsx에 컴포넌트 나열, 390/1440 두 뷰포트 스크린샷으로 오로라 일렁임·프레스·리빌 확인.
- [ ] **Step 5: Commit** — `feat(ui): 파운데이션 — 오로라(합성 전용)·리빌·토스트·공용`

---

### Task 12: 홈 — 내 캘린더 + 웰컴/할 일 카드 + 받은 초대

**Files:**
- Create: `src/components/HomeCalendar.tsx`, `src/components/WelcomeCard.tsx`, `src/components/TaskCard.tsx`
- Modify: `src/app/page.tsx` (reducer 연결, step 렌더 분기 시작)

**Interfaces:**
- Consumes: `ORG`, `ME_ID`, `INCOMING_INVITE`, reducer, Aurora("home"), Reveal
- Produces: `<HomeCalendar meEvents onNewEvent onOpenInvite confirmedMeeting responseBadges />` — 데스크톱 주간 그리드/모바일 단일 컬럼+요일 칩(v1 레이아웃 관례, 구현은 새로)

- [ ] **Step 1: 구현** — 내 일정(이찬의 events) 렌더, 상단에 INCOMING_INVITE 카드(빨간 응답 대기 도트), TaskCard "📌 다음 주까지: 팀 회의 잡기 · 6명"(탭 → 6인 프리필 SET 액션들 + step setup), WelcomeCard(첫 방문 1회 — localStorage 아닌 state, `회의 잡아보기`/`천천히 둘러볼게요`). 드래그 없음.
- [ ] **Step 2: 확인** — dev 서버에서 두 뷰포트 렌더, TaskCard 탭 → 셋업 프리필 진입 확인.
- [ ] **Step 3: Commit** — `feat(ui): 홈 — 분기점(할 일 카드·받은 초대·웰컴)`

---

### Task 13: 셋업 — 모핑 폼 + 참석자 피커 + 프로필 피크

**Files:**
- Create: `src/components/SetupForm.tsx`, `src/components/AttendeePicker.tsx`, `src/components/ProfilePeek.tsx`

**Interfaces:**
- Consumes: reducer, `deriveInsights`, `windowFor`
- Produces: `<SetupForm state dispatch />`, `<ProfilePeek person windowDays />` — 피크 '다' 안: 헤더 없음, 미니 주간 블록(기한 창 범위) + 각주 한 줄(`insights.headline`)

- [ ] **Step 1: 모핑 구현** — 참석자 2인 이상 되는 순간(AnimatePresence): 날짜·시작종료 필드 collapse(height+opacity, 450ms 한 호흡) → 길이 칩(30/60/90, 기본 60) + 기한 칩(이번 주 안에/다음 주까지/여유 있어요, 기본 다음 주까지) stagger 등장, CTA 텍스트 크로스페이드 `일정 만들기`→`시간 찾아보기`. 혼자로 돌아오면 역방향.
- [ ] **Step 2: 참석자 행** — 이름+꼭/선택 핀(기본 꼭 참석, 탭 토글), 아바타 탭 → ProfilePeek 인라인 expand(모바일)/팝오버(PC). 피커는 20명 검색·선택(멀티), 피커 안에서도 아바타 탭 피크.
- [ ] **Step 3: 확인** — 모핑 왕복·피크·핀 토글·기한 칩 동작을 두 뷰포트에서 확인. 개인 일정 저장 경로(참석자 없음 → 홈 캘린더에 이벤트 추가)도 확인.
- [ ] **Step 4: Commit** — `feat(ui): 모핑 셋업 — 기한 일급 입력·온디맨드 피크`

---

### Task 14: 스캔 모먼트

**Files:**
- Create: `src/components/ScanMoment.tsx`

**Interfaces:**
- Consumes: `insights[id].scanLine`, Aurora("scan")
- Produces: `<ScanMoment attendees insights onDone />` — `시간 찾아보기` 후 1회(~1.2초): 아바타 순차 점등 + scanLine 시퀀스 + 진행 바, 마지막 "모두를 생각한 1시간을 찾았어요". `state.scanPlayed`로 재생 1회 보장. reduced-motion → 즉시 onDone + aria-live.

- [ ] **Step 1: 구현 → Step 2: 확인**(재진입 시 스킵 확인) **→ Step 3: Commit** — `feat(ui): 스캔 모먼트 — 패턴 추출기 실출력 1회 연출`

---

### Task 15: 시간 찾기 — 모바일 추천 리스트 (히어로 1/2)

**Files:**
- Create: `src/components/ReasonCard.tsx`, `src/components/MiniLocator.tsx`, `src/components/FindTimeMobile.tsx`, `src/components/CandidateGrid.tsx`(시간표 토글 보조 뷰)

**Interfaces:**
- Consumes: `rankSlots` 결과, reducer
- Produces: **`<ReasonCard slot attendees expanded onSelect />` — PC 레일과 공유하는 단일 컴포넌트(Flat API: `<ReasonCard slot .../>`, Compound: `<ReasonCard.Frame><ReasonCard.When/><ReasonCard.Reasons/></ReasonCard.Frame>` — README 언급용 이중 API).** `<MiniLocator day start windowDays />` = 5칸 스트립+위치 점.

- [ ] **Step 1: 구현** — 상단 타이틀("모두를 생각한 1시간이에요" + 조건 요약), 카드: 시간+Badge+요약 1줄(`summarizeSlot`)+MiniLocator, 탭 → 그 자리 이유 칩 확장(40ms 스태거). 조건 변경(길이·기한·꼭/선택 — 조건 디스클로저) → `LayoutGroup` FLIP 즉시 재정렬(보이는 상위 5개만 layout). `시간표로 보기` 토글 → CandidateGrid(후보 밴드 탭 선택). 하단 고정 CTA "이 시간으로 할게요". 결정 모먼트 트리거는 표시 후보 기준.
- [ ] **Step 2: 확인** — S1 데이터로 카드 3종(추천/일부 아쉬움/주의) 이유 문장 검수(부분 참석·점심 리듬·외근·점심 보호 칩이 스펙 문구와 일치), FLIP 즉시성 확인.
- [ ] **Step 3: Commit** — `feat(ui): 시간 찾기 모바일 — 이유 카드·미니 로케이터·FLIP`

---

### Task 16: 시간 찾기 — PC 캔버스 + 레일 (히어로 2/2)

**Files:**
- Create: `src/components/FindTimeDesktop.tsx`, `src/components/WeekCanvas.tsx`

**Interfaces:**
- Consumes: ReasonCard(재사용), rankSlots 결과
- Produces: `<WeekCanvas days teamEvents candidates selectedId hoveredId onHover onSelect />` — 주간 그리드(9~19시), 팀 일정 무채색 블록(호버 시 소유자·제목 툴팁), 후보 = 파란 밴드 레이어, 선택 = 솔리드 카드.

- [ ] **Step 1: 구현** — 좌측 조건 패널, 중앙 캔버스, 우측 ReasonCard 레일. **상호 하이라이트**: 카드 hover/select ↔ 밴드 글로우/카드 링(150~200ms ease-out, 상태는 hoveredId 하나로 단방향). 셀·밴드 전부 memo.
- [ ] **Step 2: 확인** — 1440px 스크린샷 검수(밴드 벽 아님·차분함), 상호 하이라이트 동작, 프레임 드랍 육안 확인. **미감 판정 게이트**: 부족하면 즉시 탭 구조 후퇴 결정(카드 재사용— 손실 없음) 후 기록.
- [ ] **Step 3: Commit** — `feat(ui): 시간 찾기 PC — 지도 앱 패턴(캔버스+레일+상호 하이라이트)`

---

### Task 17: 결정 모먼트 + 빈 상태

**Files:**
- Create: `src/components/DecisionMoment.tsx`

**Interfaces:**
- Consumes: `suggestRelaxations`, `findBottleneck`, reducer(`ALLOW_PARTIAL`, `SET_DEADLINE`, `SET_DURATION`)
- Produces: `<DecisionMoment suggestions bottleneck onPick />` — 표시 후보 전멸/전부 warning 시 1회. 선택지: 기한 미루기("후보 N개가 생겨요" = 시뮬 실측)·30분 회의·필수 부분 참석 허락("준호님이 앞 30분만 함께해도 괜찮아요 — 수 2:00가 열려요"). 선택 즉시 조건 반영→FLIP.

- [ ] **Step 1: 구현 → Step 2: 확인** — S4 재현: 기한을 "이번 주 안에"로 → 결정 모먼트 등장 → 부분 참석 허락 → 해당 후보 등장+이유 명시. **→ Step 3: Commit** — `feat(ui): 결정 모먼트 — 정직한 중재·허락제 부분 참석`

---

### Task 18: 확정 + 완료

**Files:**
- Create: `src/components/ConfirmStep.tsx`, `src/components/DoneStep.tsx`

**Interfaces:**
- Consumes: `availableRooms`, reducer, Aurora("done"), RESPONSE_SCRIPT(발화는 Task 19)
- Produces: 확정 — 슬롯 요약+완화 토글(선택 슬롯 맥락 기반: after-lunch면 "10분 늦춰 시작"·back-to-back이면 "50분 회의"·partial 있으면 "퇴장 5분 전 알림")+회의실 목록(**자동 선택 없음**, 딱 맞는 방에 `추천` Badge, 방 0개면 화상 옵션에 Badge, 시간 변경 시 FLIP). 완료 — 체크 팝(제자리 팝 스프링)+이리데슨트 타이틀(clip-text `#7890EA→#50D5FF→#FFFFBB`, 8s sheen)+확정 요약+**"함께 챙긴 것"** 카드(양해 문구·안건 순서·화상 링크 — 선택 슬롯의 reasons/partials에서 파생)+`참석자에게는 이렇게 보여요`+`내 캘린더에서 보기`. 응답 연출 없음(홈 토스트로).

- [ ] **Step 1: 구현 → Step 2: 확인**(완화 토글이 확정 요약·초대문에 반영되는지) **→ Step 3: Commit** — `feat(ui): 확정·완료 — 배려를 시스템이 표현`

---

### Task 19: 여정 B — 초대 뷰·응답 + 홈 응답 토스트

**Files:**
- Create: `src/components/InviteView.tsx`
- Modify: `src/app/page.tsx`(확정 후 홈 복귀 시 RESPONSE_SCRIPT 재생), `src/components/HomeCalendar.tsx`(응답 배지)

**Interfaces:**
- Consumes: `INCOMING_INVITE`(reasonsForMe — 수신자 관점 문장, 내 행 강조), notifications 스토어
- Produces: 초대 뷰(참석할게요/어려워요+사유 칩 1회→"민수님에게 전달했어요"→내 캘린더 반영), 확정 후 홈에서 3/6/10초 토스트(준호 ✓→서연 ✓→하늘 "앞 30분 참석")+알림 센터 적립+캘린더 회의에 응답 배지.

- [ ] **Step 1: 구현 → Step 2: 확인** — 여정 B 전체 완주 + 확정→홈 복귀→토스트 시퀀스. **→ Step 3: Commit** — `feat(ui): 여정 B + 실시간 응답 토스트 — 살아있는 제품`

---

### Task 20: 통합 스모크 + 배포

**Files:**
- Modify: 발견되는 파일들 / Create: `README.md`(임시 — 케이스 스터디는 폴리시 데이)

**Interfaces:** 없음(게이트 태스크)

- [ ] **Step 1: 전체 테스트** — `npx vitest run` → 전부 PASS, `npx tsc --noEmit` → 클린, `npm run build` → 성공
- [ ] **Step 2: Playwright 스모크(두 뷰포트)** — 390·1440에서: 홈→할일 카드→모핑 확인→스캔→추천 카드 이유 확장→선택→확정(방 선택)→완료→홈 토스트 3개 도착 / 홈→초대→응답. 콘솔 에러 0. 스크린샷 보관.
- [ ] **Step 3: reduced-motion 확인** — 에뮬레이션 켜고 스캔 스킵·FLIP 정지 확인
- [ ] **Step 4: Vercel 배포** — vercel:deploy 스킬로 프리뷰 배포 → 배포 URL에서 핵심 플로우 1회 재완주
- [ ] **Step 5: Commit + 상태 보고** — `chore: v2 전체 빌드 완료 — 오늘 빌드 게이트 통과`. 이후(7/8~)는 폴리시 백로그로: 실기기 튜닝 패스·성능 프로파일링·README 케이스 스터디·OG/파비콘·필수답변 3종·PC 캔버스 미감 재판정.

---

## Self-Review 결과

- **스펙 커버리지**: §1 서사→README는 폴리시 백로그(7/8 명시), §2 전 화면→Task 12~19, 엔진 8단계→Task 2~8(6단계 rooms 선행수정 포함), 결함 13건→Task 4·7 테스트로 핀, §4 각본→Task 9, §5 모션·오로라·폰트→Task 1·11·글로벌 제약, 알림→Task 10·19, 웰컴/할일→Task 12, QA·배포→Task 20. 갭 없음.
- **플레이스홀더**: UI 태스크의 코드는 계약+구조 수준이나 모든 수치·문구·동작이 스펙과 글로벌 제약에 실값으로 존재 — 실행자는 본 계획+스펙만으로 구현 가능.
- **타입 일관성**: ScoreEffect/SlotReason/PartialInfo/PersonInsights/RelaxationSuggestion 명칭을 Task 3에서 고정하고 이후 전 태스크가 동일 명칭 사용 확인.
