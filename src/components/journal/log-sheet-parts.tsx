"use client";

/** 記一筆 sheet 的三段（作品／什麼時候／在哪裡）與蓋章層；狀態全由 log-sheet.tsx 持有 */

import type { RecentLogWork } from "@/lib/journal/recent-works";
import { VENUES, VENUE_LABELS, type Venue } from "@/lib/journal/types";
import { WHEN_OPTIONS, type ResolvedWhen, type WhenChoice } from "@/lib/journal/when";
import { WorkCover } from "@/components/covers/work-cover";
import { isSquareCover } from "@/lib/works/format";
import { HIT_Y6 } from "./hit-area";
import { VenueIcon } from "./icons";

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <span className="text-caption font-bold tracking-[0.16em] text-ink-950">
      <span className="font-serif-tc text-ember-dark">{index}</span>　{children}
    </span>
  );
}

export function workLabel(work: RecentLogWork): string {
  if (work.kind === "podcast_episode") {
    const show = work.podcast_show ?? work.title;
    return work.episode_number ? `${show} ${work.episode_number}` : show;
  }
  return work.title;
}

/** 卡片上的作品名：Podcast 用節目名 */
export function workDisplayName(work: RecentLogWork): string {
  return work.kind === "podcast_episode" && work.podcast_show ? work.podcast_show : work.title;
}

function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <span className="absolute -top-[5px] -right-[5px] flex size-[18px] items-center justify-center rounded-full bg-ember-dark">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-paper)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12l5 5 9-10" />
      </svg>
    </span>
  );
}

function RecentCover({ work, selected }: { work: RecentLogWork; selected: boolean }) {
  const ring = selected ? "shadow-[0_0_0_2px_var(--color-paper),0_0_0_4px_var(--color-ember-dark)]" : "";
  return (
    // Podcast、音樂是方形封面（1:1），其他 2:3
    <span className={`relative block w-14 ${isSquareCover(work) ? "h-14" : "h-[84px]"} ${ring}`}>
      <WorkCover cover={{ kind: work.kind, title: workDisplayName(work), posterUrl: work.poster_url }} size="sm" className="size-full" />
      {selected ? <CheckBadge /> : null}
    </span>
  );
}

interface WorkRowProps {
  works: RecentLogWork[];
  selectedId: string | null;
  loading: boolean;
  onPick: (work: RecentLogWork) => void;
  onSearch: () => void;
}

export function WorkRow({ works, selectedId, loading, onPick, onSearch }: WorkRowProps) {
  return (
    <div data-tour="log-work" className="px-4 pt-2.5">
      <div className="flex items-baseline justify-between">
        <SectionLabel index="一">作品</SectionLabel>
        <button type="button" onClick={onSearch} className={`${HIT_Y6} flex min-h-8 items-center text-caption text-ink-700`}>
          找其他作品 ›
        </button>
      </div>
      <div role="radiogroup" aria-label="作品" className="-mr-4 mt-2 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button type="button" onClick={onSearch} aria-label="搜尋作品" className="flex w-14 flex-none flex-col gap-[5px]">
          <span className="flex h-[84px] w-14 items-center justify-center rounded-control border border-dashed border-ink-400 text-ink-700">
            <SearchGlyph />
          </span>
          <span className="text-center text-eyebrow text-ink-700">搜尋</span>
        </button>
        {loading
          ? [0, 1, 2, 3].map((index) => (
              <span key={index} aria-hidden="true" className="block h-[84px] w-14 flex-none bg-paper-2" />
            ))
          : works.map((work) => {
              const selected = work.id === selectedId;
              return (
                <button
                  key={work.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPick(work)}
                  className="flex w-14 flex-none flex-col gap-[5px] text-left"
                >
                  <RecentCover work={work} selected={selected} />
                  <span className={`line-clamp-2 text-eyebrow leading-[1.35] ${selected ? "font-bold text-ink-950" : "text-ink-700"}`}>
                    {workLabel(work)}
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
}

/** 票根撕線：兩端缺口＝遮罩疊在紙上的顏色 */
export function Perforation() {
  return (
    <div aria-hidden="true" className="relative mt-2.5 h-[22px] overflow-clip">
      <span className="absolute top-0 -left-[11px] block size-[22px] rounded-full bg-ticket-notch" />
      <span className="absolute top-0 -right-[11px] block size-[22px] rounded-full bg-ticket-notch" />
      <span className="absolute top-2.5 right-5 left-5 block border-t border-dashed border-ticket-perforation" />
    </div>
  );
}

interface WhenSectionProps {
  choice: WhenChoice;
  resolved: ResolvedWhen;
  custom: string;
  onChoose: (choice: WhenChoice) => void;
  onCustom: (value: string) => void;
}

export function WhenSection({ choice, resolved, custom, onChoose, onCustom }: WhenSectionProps) {
  return (
    <div className="px-4 pt-1">
      <SectionLabel index="二">什麼時候</SectionLabel>
      <div className="mt-2 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3.5">
        <div aria-hidden="true" className="h-16 -rotate-3 rounded-control border-[1.5px] border-stamp-ink p-[3px]">
          <div className="flex h-full flex-col items-center justify-center gap-0.5 rounded-[2px] border border-stamp-ink">
            <span className="text-lede font-bold tracking-[0.06em] text-stamp-ink tabular-nums">{resolved.stampDate}</span>
            <span className="pl-[0.2em] text-eyebrow tracking-[0.2em] text-stamp-ink">{resolved.stampTime}</span>
          </div>
        </div>
        <div role="radiogroup" aria-label="什麼時候" className="grid grid-cols-2 gap-x-2.5">
          {WHEN_OPTIONS.map((option) => {
            const on = option.value === choice;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChoose(option.value)}
                className={`min-h-11 text-left text-note ${on ? "font-bold text-ink-950" : "text-ink-700"}`}
              >
                <span className={`pb-[3px] ${on ? "shadow-[inset_0_-2px_0_var(--color-ember)]" : ""}`}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {choice === "custom" ? (
        <label className="mt-1 flex min-h-11 items-center gap-2.5 border-b border-ink-200">
          <span className="flex-none text-caption text-ink-600">日期時間</span>
          <input
            type="datetime-local"
            value={custom}
            aria-label="日期時間"
            onChange={(event) => onCustom(event.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent text-lede text-ink-950 outline-none"
          />
        </label>
      ) : null}
    </div>
  );
}

export function PlaceSection({ place, onPick }: { place: Venue | null; onPick: (venue: Venue) => void }) {
  return (
    <div className="px-4 pt-3.5">
      <SectionLabel index="三">在哪裡</SectionLabel>
      <div role="radiogroup" aria-label="在哪裡" className="mt-2 grid grid-cols-3 gap-2">
        {VENUES.map((venue) => {
          const on = venue === place;
          return (
            <button
              key={venue}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(venue)}
              className={`flex h-[60px] flex-col items-center justify-center gap-1 rounded-control border transition-colors duration-150 ${
                on
                  ? "border-place-selected-border bg-place-selected-bg font-bold text-ember-deep"
                  : "border-ink-200 bg-paper text-ink-800"
              }`}
            >
              <VenueIcon venue={venue} />
              <span className="text-caption">{VENUE_LABELS[venue]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface StampOverlayProps {
  /** 日期，例「10 月 8 日」 */
  dateLine: string;
  caption: string;
  /** 斑駁的種子：同一天的章長得一樣 */
  seed: number;
  /** 章頂小字：日誌／場外 */
  kind?: string;
}

/** 斑駁：紙色小點 9 處（1.5–4px），位置以日期為種子，同一天的章長得一樣 */
function speckles(seed: number): Array<{ left: number; top: number; size: number }> {
  return Array.from({ length: 9 }, (_, index) => {
    const n = (seed * 31 + index * 97) % 1000;
    return { left: 6 + ((n * 7) % 88), top: 8 + ((n * 13) % 84), size: 1.5 + ((n * 3) % 26) / 10 };
  });
}

/**
 * 記下後的日期戳章（P4 〇二）：ink-900 雙框、整枚 .92 透明＋紙色斑駁；
 * 內容先淡出 160ms，章 1.15→1、0°→−3° 用 exit 曲線 200ms 落下，停 600ms 後 sheet 收起。
 */
export function StampOverlay({ dateLine, caption, seed, kind = "日誌" }: StampOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div
        className="p4-stamp relative w-[220px] rounded-[2px] border-[1.5px] border-ink-900 p-[3px] [animation-delay:160ms]"
        style={{ "--stamp-angle": "-3deg" } as React.CSSProperties}
      >
        <div className="flex flex-col items-center gap-1.5 rounded-[1px] border border-ink-900 pt-3 pb-3">
          <span className="pl-[0.3em] text-eyebrow tracking-[0.3em] text-ink-900">散場誌・{kind}</span>
          <span className="pl-[0.12em] font-serif-tc text-headline font-bold tracking-[0.12em] text-ink-900">{dateLine}</span>
          <span className="max-w-[188px] truncate font-serif-tc text-caption tracking-[0.06em] text-ink-900">{caption}</span>
        </div>
        {speckles(seed).map((dot, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="absolute block rounded-full bg-paper"
            style={{ left: `${dot.left}%`, top: `${dot.top}%`, width: dot.size, height: dot.size }}
          />
        ))}
      </div>
    </div>
  );
}
