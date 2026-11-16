"use client";

/**
 * 記一筆・場外變體（設計稿「P3 場外 C」）：場域選「音樂祭/演出」或「展覽」時，
 * 「一」改成名稱手寫＋場地＋日期兩列；server 依名稱＋日期歸入同一本場刊。
 * 散場之前（Q-36）：再加「類型」（場館類型，依演出／展覽那一層）與「售票」網址（選填）。
 * 封面補齊：再加「封面」（貼網址或上傳，選填）。
 */

import { CoverField } from "@/components/covers/cover-field";
import type { Venue } from "@/lib/journal/types";
import { isVenueTypeFor, VENUE_TYPE_OPTIONS } from "@/lib/venue/venue-type";
import { HIT_Y6 } from "./hit-area";

export interface LiveDraft {
  name: string;
  venue: string;
  dates: string;
  /** 場館類型（VenueType）；空字串＝沒選 */
  venueType: string;
  ticketUrl: string;
  /** 封面圖片網址（貼的或上傳後的 Storage 網址）；空字串＝沒填 */
  coverUrl: string;
}

export const EMPTY_LIVE_DRAFT: LiveDraft = { name: "", venue: "", dates: "", venueType: "", ticketUrl: "", coverUrl: "" };

/** 送出用：類型只送屬於這一層的（切換演出／展覽後舊選擇自動失效） */
export function liveLinkFields(place: Venue, draft: LiveDraft) {
  return {
    liveVenueType: isLiveVenue(place) && isVenueTypeFor(place, draft.venueType) ? draft.venueType : null,
    liveTicketUrl: draft.ticketUrl.trim() || null,
    liveCoverUrl: draft.coverUrl.trim() || null,
  };
}

/** 場外場域：作品欄改成手寫 */
export function isLiveVenue(place: Venue | null): place is "live" | "exhibition" {
  return place === "live" || place === "exhibition";
}

interface LiveFieldsProps {
  place: "live" | "exhibition";
  draft: LiveDraft;
  onChange: (draft: LiveDraft) => void;
}

export function LiveFields({ place, draft, onChange }: LiveFieldsProps) {
  const set = (field: keyof LiveDraft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...draft, [field]: event.target.value });
  const toggleType = (value: string) => onChange({ ...draft, venueType: draft.venueType === value ? "" : value });
  return (
    <div className="px-4 pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex-none text-caption font-bold tracking-[0.16em] text-ink-950">
          <span className="font-serif-tc text-ember-dark">一</span>　{place === "exhibition" ? "哪一檔展" : "哪一場"}
        </span>
        <span className="min-w-0 truncate text-eyebrow text-ink-600">場外先手寫，之後會幫你對上同一場的人</span>
      </div>
      <label className="mt-1 flex min-h-12 items-center border-b border-ink-950">
        <span className="sr-only">演出名或展覽名</span>
        <input
          value={draft.name}
          onChange={set("name")}
          maxLength={100}
          placeholder="演出名或展覽名"
          className="h-11 min-w-0 flex-1 bg-transparent font-serif-tc text-prose font-bold text-ink-950 outline-none placeholder:font-normal placeholder:text-ink-400"
        />
      </label>
      <label className="flex min-h-11 items-center gap-3 border-b border-ink-200">
        <span className="w-7 flex-none text-caption tracking-[0.08em] text-ink-600">場地</span>
        <input
          value={draft.venue}
          onChange={set("venue")}
          maxLength={100}
          placeholder="哪個場館、哪片草地"
          className="h-[42px] min-w-0 flex-1 bg-transparent font-serif-tc text-lede text-ink-950 outline-none placeholder:text-ink-400"
        />
      </label>
      <label className="flex min-h-11 items-center gap-3 border-b border-ink-200">
        <span className="w-7 flex-none text-caption tracking-[0.08em] text-ink-600">日期</span>
        <input
          value={draft.dates}
          onChange={set("dates")}
          maxLength={60}
          inputMode="text"
          placeholder="演出日或展期，例：10.09 – 10.10"
          className="h-[42px] min-w-0 flex-1 bg-transparent font-serif-tc text-lede text-ink-950 tabular-nums outline-none placeholder:text-ink-400"
        />
      </label>
      <div className="flex min-h-11 items-center gap-3 border-b border-ink-200 py-1.5">
        <span className="w-7 flex-none text-caption tracking-[0.08em] text-ink-600">類型</span>
        <div role="radiogroup" aria-label="場館類型" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {VENUE_TYPE_OPTIONS[place].map((option) => {
            const on = option.value === draft.venueType;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => toggleType(option.value)}
                className={`${HIT_Y6} min-h-8 rounded-control border px-2.5 text-caption transition-colors duration-150 ${
                  on ? "border-place-selected-border bg-place-selected-bg font-bold text-ember-deep" : "border-ink-200 text-ink-800"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3 border-b border-ink-200">
        <span className="w-7 flex-none text-caption tracking-[0.08em] text-ink-600">售票</span>
        <input
          type="url"
          inputMode="url"
          value={draft.ticketUrl}
          onChange={set("ticketUrl")}
          maxLength={2000}
          placeholder="售票網址（選填）"
          className="h-[42px] min-w-0 flex-1 bg-transparent text-lede text-ink-950 outline-none placeholder:text-ink-400"
        />
      </label>
      <CoverField value={draft.coverUrl} onChange={(coverUrl) => onChange({ ...draft, coverUrl })} />
    </div>
  );
}
