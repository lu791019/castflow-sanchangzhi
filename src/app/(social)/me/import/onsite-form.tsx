"use client";

/** 場外（演出／展覽）：名稱＋場地＋日期，走既有 POST /api/works 手動建立（同名同日歸入既有場刊） */

import { useState } from "react";
import { createWork } from "@/components/work-picker/client";
import type { PickerWork } from "@/lib/work-picker/types";

type OnsiteKind = "live" | "exhibition";

const KINDS: Array<{ value: OnsiteKind; label: string }> = [
  { value: "live", label: "演出" },
  { value: "exhibition", label: "展覽" },
];

const FIELD = "min-h-11 border-0 border-b border-ink-950 bg-transparent p-0 text-prose text-ink-950 outline-none placeholder:text-ink-400";

export function OnsiteForm({
  defaultTitle,
  defaultKind,
  onCreated,
}: {
  defaultTitle: string;
  defaultKind: OnsiteKind;
  onCreated: (work: PickerWork) => void;
}) {
  const [kind, setKind] = useState<OnsiteKind>(defaultKind);
  const [title, setTitle] = useState(defaultTitle);
  const [venue, setVenue] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await createWork({ source: "manual", kind, title: title.trim(), venue: venue.trim() || null, eventDate: eventDate || null }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "建立失敗，再試一次");
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="場外作品"
      className="mt-3 border-t border-ink-200 pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div role="radiogroup" aria-label="場外類型" className="flex gap-x-[22px]">
        {KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={kind === option.value}
            onClick={() => setKind(option.value)}
            className={`min-h-11 text-lede ${
              kind === option.value ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="mt-2 flex flex-col gap-1">
        <span className="text-caption text-ink-600">名稱</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} autoComplete="off" className={`${FIELD} font-serif-tc`} />
      </label>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-600">場地</span>
          <input value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={80} autoComplete="off" placeholder="例：台北流行音樂中心" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-600">日期</span>
          <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={FIELD} />
        </label>
      </div>
      {error ? <p className="mt-2 mb-0 text-caption text-ember-deep">{error}</p> : null}
      <button
        type="submit"
        disabled={!title.trim() || busy}
        className="mt-4 h-11 w-full rounded-[4px] border border-ink-950 text-note font-bold text-ink-950 disabled:opacity-50"
      >
        {busy ? "建立中…" : "用這個名稱"}
      </button>
    </form>
  );
}
