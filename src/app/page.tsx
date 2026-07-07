'use client';

import { useRef, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import Aurora, { type AuroraVariant } from '../components/Aurora';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Chip from '../components/Chip';
import NotificationBell from '../components/NotificationBell';
import Reveal from '../components/Reveal';
import ToastStack from '../components/ToastStack';
import Wordmark from '../components/Wordmark';
import { useNotifications } from '../app-state/notifications';
import { CORE_CAST, ORG } from '../data/world';
import type { NotificationKind } from '../lib/types';

/**
 * [임시] T11 컴포넌트 갤러리 — UI 파운데이션 육안 검증용. T12(홈)가 이 파일을 대체한다.
 */

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text-weak">{label}</h2>
      {children}
    </section>
  );
}

const AURORA_VARIANTS: { variant: AuroraVariant; note: string }[] = [
  { variant: 'home', note: '홈 — 은은한 공기감' },
  { variant: 'scan', note: '스캔 — 깊은 맥락' },
  { variant: 'done', note: '완료 — 가장 따뜻하게' },
];

const DEMO_TOASTS: { kind: NotificationKind; personId?: string; text: string }[] = [
  { kind: 'response', personId: 'junho', text: '준호님이 참석해요' },
  { kind: 'response', personId: 'seoyeon', text: '서연님이 참석해요' },
  { kind: 'invite', text: '민수님이 디자인 리뷰에 초대했어요' },
  { kind: 'confirmed', text: '수요일 오전 10시로 확정됐어요' },
];

const CORE_PEOPLE = CORE_CAST.map((id) => ORG.find((p) => p.id === id)!);

export default function GalleryPage() {
  const { toasts, unreadCount, push, dismiss } = useNotifications();
  const toastSeq = useRef(0);
  const [revealKey, setRevealKey] = useState(0);
  const [deadline, setDeadline] = useState('this-week');
  const [duration, setDuration] = useState('60');

  const pushDemo = (index: number) => {
    const spec = DEMO_TOASTS[index % DEMO_TOASTS.length];
    toastSeq.current += 1;
    push({ id: `demo-${toastSeq.current}`, at: 0, ...spec });
  };

  return (
    <main className="mx-auto max-w-[720px] space-y-14 px-5 py-14">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="text-[12px] text-text-faint">T11 · UI 파운데이션 갤러리 (임시)</span>
      </header>

      <Section label="오로라 — 합성 전용, 순간에만">
        <div className="grid gap-3 sm:grid-cols-3">
          {AURORA_VARIANTS.map(({ variant, note }) => (
            <figure key={variant} className="space-y-2">
              <div className="relative h-44 overflow-hidden rounded-card ring-1 ring-border/60">
                <Aurora variant={variant} />
                <span className="absolute bottom-3 left-3.5 font-display text-[15px] font-semibold text-text-strong">
                  {variant}
                </span>
              </div>
              <figcaption className="text-[12px] text-text-weak">{note}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section label="리빌 — blur-rise 등장, 60~80ms 스태거">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setRevealKey((k) => k + 1)}
            className="pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-section px-4 text-[14px] font-medium text-text-body"
          >
            <RotateCcw size={14} aria-hidden />
            다시 재생
          </button>
          <div key={revealKey} className="grid gap-3 sm:grid-cols-3">
            {[
              { title: '수요일 오전 10시', sub: '여섯 명 모두 괜찮아요' },
              { title: '목요일 오후 2시', sub: '하늘님이 앞 30분 함께해요' },
              { title: '금요일 오전 11시', sub: '점심과 딱 붙어 있어요' },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 70}>
                <div className="space-y-1 rounded-card bg-white p-4 shadow-[0_2px_12px_rgba(25,31,40,0.06)] ring-1 ring-border/60">
                  <p className="text-[15px] font-semibold text-text-strong">{card.title}</p>
                  <p className="text-[13px] text-text-body">{card.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section label="아바타 — 핵심 6인 + 크기 + 이니셜 폴백">
        <div className="space-y-4 rounded-card bg-white p-5 ring-1 ring-border/60">
          <div className="flex items-end gap-3">
            {CORE_PEOPLE.map((person) => (
              <figure key={person.id} className="flex flex-col items-center gap-1.5">
                <Avatar person={person} size={40} />
                <figcaption className="text-[11px] text-text-weak">{person.name}</figcaption>
              </figure>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
            <Avatar person={CORE_PEOPLE[0]} size={40} />
            <Avatar person={CORE_PEOPLE[0]} size={32} />
            <Avatar person={CORE_PEOPLE[0]} size={24} />
            <span className="mx-2 h-6 w-px bg-border" aria-hidden />
            <Avatar name="김손님" size={40} />
            <Avatar name="박외부" size={32} />
            <Avatar person={CORE_PEOPLE[3]} size={40} onClick={() => undefined} />
            <span className="text-[12px] text-text-weak">이니셜 폴백 · 마지막은 onClick 프레스</span>
          </div>
        </div>
      </Section>

      <Section label="칩 — 기한 · 길이">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'this-week', label: '이번 주' },
              { value: 'next-week', label: '다음 주' },
              { value: 'flexible', label: '여유 있어요' },
            ].map((c) => (
              <Chip key={c.value} selected={deadline === c.value} onClick={() => setDeadline(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: '30', label: '30분' },
              { value: '60', label: '1시간' },
              { value: '90', label: '1시간 30분' },
            ].map((c) => (
              <Chip key={c.value} selected={duration === c.value} onClick={() => setDuration(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      <Section label="배지 — 상태는 항상 텍스트 병기">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="rec">추천</Badge>
          <Badge tone="ok">일부 아쉬움</Badge>
          <Badge tone="warn">주의</Badge>
        </div>
      </Section>

      <Section label="토스트 — 최대 3장 스택, 4초 자동 소멸, 클릭 시 닫힘">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pushDemo(toastSeq.current)}
            className="pressable inline-flex h-9 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-white"
          >
            토스트 하나
          </button>
          <button
            type="button"
            onClick={() => {
              pushDemo(0);
              setTimeout(() => pushDemo(1), 450);
              setTimeout(() => pushDemo(3), 900);
            }}
            className="pressable inline-flex h-9 items-center rounded-full bg-section px-4 text-[14px] font-medium text-text-body"
          >
            연달아 3개
          </button>
        </div>
      </Section>

      <Section label="알림 벨 — 안 읽음 도트 팝">
        <div className="flex items-center gap-6 rounded-card bg-white p-5 ring-1 ring-border/60">
          <div className="flex items-center gap-2">
            <NotificationBell unreadCount={0} />
            <span className="text-[12px] text-text-weak">읽음</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell unreadCount={unreadCount || 3} />
            <span className="text-[12px] text-text-weak">
              안 읽음{unreadCount > 0 ? ` ${unreadCount}개 (토스트 연동)` : ''}
            </span>
          </div>
        </div>
      </Section>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
