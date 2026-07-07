'use client';

import { useState } from 'react';
import type { Attendee, CandidateSlot } from '../lib/types';
import { HARD_BLOCK_KINDS } from '../lib/partial';
import { fmtDayKorean, fmtTime, overlaps, addDaysISO, type Minutes } from '../lib/time';
import { mondayOf, weekIndexOf, weekLabel, weekMondays } from './MiniLocator';

/**
 * 시간표 보기 — 리스트의 보조 뷰. "후보가 주간의 어디에 앉는지"를 공간으로 보여준다.
 * 후보(표시 상위 5) = 파란 밴드(탭=선택, 선택 = 솔리드). 팀 일정은 개별 제목 없이
 * 무채색 밀도(30분 칸의 겹침 인원 농도)로만 깔린다 — 주인공은 어디까지나 후보다.
 * 기한 창이 여러 주면 주차 스위치. 보조 뷰 계약: 여기서 과투자하지 않는다.
 */

/** 그리드 세로 프레임 — 9:00~18:00(필수 근무 기본 프레임과 동일). */
export const GRID_START: Minutes = 540;
export const GRID_END: Minutes = 1080;
/** 밀도 칸 크기(분). */
export const DENSITY_BIN: Minutes = 30;

/** 분 → 세로 위치(%). 프레임 밖은 클램프. */
export function gridYPct(minutes: Minutes): number {
  const clamped = Math.min(Math.max(minutes, GRID_START), GRID_END);
  return ((clamped - GRID_START) / (GRID_END - GRID_START)) * 100;
}

/**
 * 하루의 30분 칸별 "막힌 사람 수" — 하드 블로킹 일정(meeting·offsite·personal)만 센다.
 * lunch·focus는 후보를 막지 않으므로(soft) 밀도에도 넣지 않는다 — 밀도의 의미는
 * "이 시간대는 이만큼의 사람이 진짜로 안 된다"이다.
 */
export function densityBins(attendees: Attendee[], day: string): number[] {
  const binCount = (GRID_END - GRID_START) / DENSITY_BIN;
  const bins = new Array<number>(binCount).fill(0);
  for (const a of attendees) {
    for (let i = 0; i < binCount; i++) {
      const s = GRID_START + i * DENSITY_BIN;
      const busy = a.events.some(
        (e) => e.day === day && HARD_BLOCK_KINDS.has(e.kind) && overlaps(s, s + DENSITY_BIN, e.start, e.end),
      );
      if (busy) bins[i] += 1;
    }
  }
  return bins;
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'] as const;

function hourLabel(h: number): string {
  if (h < 12) return `${h}시`;
  if (h === 12) return '12시';
  return `${h - 12}시`;
}

/** '10:00' — 밴드 안 짧은 시각(24h 표기, 칼럼이 좁다). */
function shortTime(m: Minutes): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export interface CandidateGridProps {
  /** 표시 후보(리스트와 같은 상위 5) — 밴드는 이들만 그린다(선택 일관성). */
  slots: CandidateSlot[];
  windowDays: string[];
  attendees: Attendee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function CandidateGrid({ slots, windowDays, attendees, selectedId, onSelect }: CandidateGridProps) {
  const mondays = weekMondays(windowDays);
  // 첫 화면은 1위 후보가 있는 주 — 시간표를 연 이유가 대개 그 후보의 맥락이다.
  const [week, setWeek] = useState(() => Math.max(weekIndexOf(slots[0]?.day ?? windowDays[0] ?? '', windowDays), 0));
  const windowSet = new Set(windowDays);
  const days = [0, 1, 2, 3, 4].map((i) => addDaysISO(mondays[Math.min(week, mondays.length - 1)] ?? windowDays[0], i));
  const hours = Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => GRID_START / 60 + i);

  return (
    <section aria-label="주간 시간표">
      {/* 주차 스위치 — 창이 한 주면 생략 */}
      {mondays.length > 1 && (
        <div className="mb-2.5 flex gap-1.5">
          {mondays.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-pressed={week === i}
              onClick={() => setWeek(i)}
              className={`pressable h-8 rounded-full px-3 text-[13px] transition-colors ${
                week === i ? 'bg-primary-tint font-semibold text-primary' : 'bg-section font-medium text-text-body'
              }`}
            >
              {weekLabel(i)}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-border/70">
        {/* 요일 헤더 */}
        <div className="flex border-b border-border/70">
          <div className="w-9 shrink-0" aria-hidden />
          {days.map((day, i) => {
            const inWindow = windowSet.has(day);
            return (
              <div key={day} className="flex flex-1 items-center justify-center gap-1 border-l border-border/50 py-2">
                <span className={`text-[11px] ${inWindow ? 'text-text-weak' : 'text-text-faint'}`}>
                  {WEEKDAY_LABELS[i]}
                </span>
                <span className={`text-[13px] font-semibold ${inWindow ? 'text-text-strong' : 'text-text-faint'}`}>
                  {Number(day.slice(8, 10))}
                </span>
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <div className="relative flex h-[400px]">
          {/* 시각 라벨 */}
          <div className="relative w-9 shrink-0" aria-hidden>
            {hours.slice(1, -1).map((h, i) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-text-faint"
                style={{ top: `${((i + 1) / (hours.length - 1)) * 100}%` }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {/* 시간선 */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-9 right-0">
            {hours.slice(1, -1).map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/40"
                style={{ top: `${((i + 1) / (hours.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          {days.map((day) => {
            const inWindow = windowSet.has(day);
            const bins = inWindow ? densityBins(attendees, day) : [];
            const daySlots = slots.filter((s) => s.day === day);
            return (
              <div key={day} className={`relative flex-1 border-l border-border/50 ${inWindow ? '' : 'bg-section/45'}`}>
                {/* 팀 일정 밀도 — 무채색, 제목 없음 */}
                {bins.map((count, i) =>
                  count === 0 ? null : (
                    <div
                      key={i}
                      aria-hidden
                      className="absolute inset-x-0"
                      style={{
                        top: `${(i / bins.length) * 100}%`,
                        height: `${100 / bins.length}%`,
                        backgroundColor: `rgba(139, 149, 161, ${(0.08 + 0.45 * (count / Math.max(attendees.length, 1))).toFixed(3)})`,
                      }}
                    />
                  ),
                )}
                {/* 후보 밴드 — 탭=선택, 선택은 솔리드 */}
                {daySlots.map((slot) => {
                  const selected = slot.id === selectedId;
                  const top = gridYPct(slot.start);
                  const height = gridYPct(slot.end) - top;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onSelect(slot.id)}
                      aria-pressed={selected}
                      aria-label={`${fmtDayKorean(slot.day)} ${fmtTime(slot.start)} 후보${selected ? ' — 선택됨' : ''}`}
                      className={`pressable absolute inset-x-[3px] flex items-start justify-center overflow-hidden rounded-[7px] pt-1 text-[10.5px] font-semibold leading-none transition-colors ${
                        selected
                          ? 'z-10 bg-primary text-white shadow-[0_2px_10px_rgba(49,130,246,0.4)]'
                          : 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/45'
                      }`}
                      style={{ top: `${top}%`, height: `calc(${height}% - 2px)` }}
                    >
                      {shortTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-text-faint">회색이 진할수록 팀 일정이 몰려 있어요</p>
    </section>
  );
}
