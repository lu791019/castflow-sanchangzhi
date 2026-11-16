"use client";

/** 狀態 D：查無結果 → 「找不到？手動輸入名稱」表單（名稱 + 類型；演出／展覽多「場地」「日期」） */

import { useState } from "react";
import type { WorkKind } from "@/lib/works/format";
import type { PickerKind } from "@/lib/work-picker/types";

const KIND_OPTIONS: Array<{ value: WorkKind; label: string }> = [
  { value: "movie", label: "電影" },
  { value: "series", label: "影集" },
  { value: "podcast_episode", label: "Podcast" },
  { value: "live", label: "演出" },
  { value: "exhibition", label: "展覽" },
  { value: "music", label: "音樂" },
];

export interface ManualInput {
  kind: WorkKind;
  title: string;
  venue?: string | null;
  eventDate?: string | null;
}

function isOnSiteKind(kind: WorkKind): boolean {
  return kind === "live" || kind === "exhibition";
}

/** 送出內容：只有演出／展覽帶場地、日期；空字串轉 null */
export function buildManualInput(kind: WorkKind, title: string, venue: string, eventDate: string): ManualInput {
  const base = { kind, title: title.trim() };
  if (!isOnSiteKind(kind)) return base;
  return { ...base, venue: venue.trim() || null, eventDate: eventDate || null };
}

export function pickerKindToWorkKind(kind: PickerKind): WorkKind {
  return kind === "podcast" ? "podcast_episode" : kind;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-ink-700 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ManualEntry({
  query,
  defaultKind,
  busy,
  error,
  onSubmit,
  unavailable = false,
}: {
  query: string;
  defaultKind: PickerKind;
  busy: boolean;
  error: string | null;
  onSubmit: (input: ManualInput) => void;
  /** 搜尋服務不通（錯誤 3）：不說「找不到」，表單直接展開 */
  unavailable?: boolean;
}) {
  const [open, setOpen] = useState(unavailable);
  const [title, setTitle] = useState(query);
  const [kind, setKind] = useState<WorkKind>(pickerKindToWorkKind(defaultKind));
  const [venue, setVenue] = useState("");
  const [eventDate, setEventDate] = useState("");
  const canSubmit = title.trim().length > 0 && !busy;

  return (
    <div className={unavailable ? "pt-3.5" : "pt-6"}>
      {unavailable ? null : (
        <>
          <p className="m-0 font-serif-tc text-prose leading-[1.7] font-bold text-ink-950">找不到「{query}」。</p>
          <p className="mt-1.5 mb-0 text-note leading-[1.8] text-ink-700">可能還沒收錄，或換個寫法試試。</p>
        </>
      )}
      <div className={unavailable ? "" : "mt-6 border-t border-ink-950 pt-1"}>
        {unavailable ? (
          <span className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">手動輸入名稱</span>
        ) : (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex min-h-12 w-full items-center justify-between text-lede font-bold text-ink-950"
          >
            找不到？手動輸入名稱
            <ChevronIcon open={open} />
          </button>
        )}
        {open ? (
          <form
            className="mt-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onSubmit(buildManualInput(kind, title, venue, eventDate));
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-caption text-ink-600">名稱</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                autoComplete="off"
                className="min-h-11 border-0 border-b border-ink-950 bg-transparent p-0 font-serif-tc text-prose text-ink-950 outline-none"
              />
            </label>
            <div className="mt-[18px] flex flex-col gap-0.5">
              <span className="text-caption text-ink-600">類型</span>
              <div role="radiogroup" aria-label="類型" className="flex flex-wrap gap-x-[22px]">
                {KIND_OPTIONS.map((option) => {
                  const active = option.value === kind;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setKind(option.value)}
                      className={`hit-44 min-h-11 text-lede ${
                        active ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {isOnSiteKind(kind) ? (
              <div className="mt-[18px] grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                <label className="flex flex-col gap-1">
                  <span className="text-caption text-ink-600">場地</span>
                  <input
                    value={venue}
                    onChange={(event) => setVenue(event.target.value)}
                    maxLength={80}
                    autoComplete="off"
                    placeholder="例：台北流行音樂中心"
                    className="min-h-11 border-0 border-b border-ink-950 bg-transparent p-0 text-prose text-ink-950 outline-none placeholder:text-ink-400"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-caption text-ink-600">日期</span>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                    className="min-h-11 border-0 border-b border-ink-950 bg-transparent p-0 text-prose text-ink-950 outline-none"
                  />
                </label>
              </div>
            ) : null}
            <p className="mt-3.5 mb-0 text-caption leading-[1.8] text-ink-600">
              {isOnSiteKind(kind)
                ? "場地與日期可留空。"
                : kind === "music"
                  ? "先用文字卡片代替專輯封面。"
                  : unavailable
                  ? "先用文字卡片代替海報；連上之後會自動補上資料。"
                  : "之後會自動補上海報與資料。"}
            </p>
            {error ? <p className="mt-2 mb-0 text-caption text-ember-deep">{error}</p> : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-4 h-[52px] w-full rounded-[4px] bg-ember-dark text-lede font-bold tracking-[0.1em] text-paper disabled:opacity-50"
            >
              {busy ? "建立中…" : "用這個名稱"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
