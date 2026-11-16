"use client";

/**
 * 問卷第三題：挑 3 部看過或想看的（用既有作品選擇面板）。
 * 每部都要明確選「看過／想看」，不預設看過（UX-15）；只當品味資料，不記進日誌。
 */

import { useState } from "react";
import { WorkPickerSheet } from "@/components/work-picker/work-picker-sheet";
import { MAX_PICKS } from "@/lib/taste/questionnaire";
import type { PickerWork } from "@/lib/work-picker/types";

export interface PickedWork {
  workId: string;
  title: string;
  posterUrl: string | null;
  /** null＝還沒選 */
  seen: boolean | null;
}

/** 每一部都選了看過或想看 */
export function allPicksAnswered(picks: readonly PickedWork[]): picks is ReadonlyArray<PickedWork & { seen: boolean }> {
  return picks.every((pick) => pick.seen !== null);
}

function SeenToggle({ seen, onChange, title }: { seen: boolean | null; onChange: (seen: boolean) => void; title: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={`《${title}》看過還是想看`}
      className={`flex flex-none overflow-hidden rounded-control border ${seen === null ? "border-ember-dark" : "border-ink-950"}`}
    >
      {[
        { value: true, label: "看過" },
        { value: false, label: "想看" },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={seen === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 px-3 text-note font-bold ${seen === option.value ? "bg-ink-950 text-paper" : "bg-paper text-ink-800"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Poster({ url }: { url: string | null }) {
  if (!url) return <span aria-hidden="true" className="h-[60px] w-10 flex-none rounded-[2px] bg-ink-50" />;
  // eslint-disable-next-line @next/next/no-img-element -- TMDB／iTunes 外部圖，尺寸已固定
  return <img src={url} alt="" width={40} height={60} className="h-[60px] w-10 flex-none rounded-[2px] object-cover" />;
}

function PickedRow({ pick, onSeen, onRemove }: { pick: PickedWork; onSeen: (seen: boolean) => void; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 border-b border-ink-200 py-3">
      <Poster url={pick.posterUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-serif-tc text-lede font-bold text-ink-950">{pick.title}</span>
        {pick.seen === null ? <span className="text-eyebrow text-ember-dark">看過，還是想看？</span> : null}
      </span>
      <SeenToggle seen={pick.seen} onChange={onSeen} title={pick.title} />
      <button type="button" onClick={onRemove} aria-label={`拿掉《${pick.title}》`} className="-mr-2 flex size-11 flex-none items-center justify-center text-ink-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}

export function TastePicks({ picks, onChange }: { picks: readonly PickedWork[]; onChange: (next: PickedWork[]) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function add(work: PickerWork) {
    if (picks.some((pick) => pick.workId === work.id) || picks.length >= MAX_PICKS) return;
    onChange([...picks, { workId: work.id, title: work.title, posterUrl: work.poster_url, seen: null }]);
  }

  return (
    <>
      <ul className="m-0 list-none border-t border-ink-950 p-0">
        {picks.map((pick) => (
          <PickedRow
            key={pick.workId}
            pick={pick}
            onSeen={(seen) => onChange(picks.map((item) => (item.workId === pick.workId ? { ...item, seen } : item)))}
            onRemove={() => onChange(picks.filter((item) => item.workId !== pick.workId))}
          />
        ))}
      </ul>
      {picks.length < MAX_PICKS ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-ink-400 text-lede font-bold text-ink-800"
        >
          <span aria-hidden="true">＋</span>
          挑一部（{picks.length}/{MAX_PICKS}）
        </button>
      ) : null}
      <WorkPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={add} title="挑一部看過或想看的" />
    </>
  );
}
