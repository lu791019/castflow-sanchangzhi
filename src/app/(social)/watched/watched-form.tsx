"use client";

/**
 * 「看完了」（Q-69）：作品＋星等＋場域／同行 → 說一段（錄音或打字）→ Threads 產出頁。
 * 送出時建（或沿用）日誌，再交給既有的說一段流程（/say?journal=<id>&next=watched）。
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WorkCover } from "@/components/covers/work-cover";
import { PageHeader } from "@/components/layout/page-header";
import { StarRating } from "@/components/watched/star-rating";
import { WorkPickerSheet } from "@/components/work-picker/work-picker-sheet";
import { VENUE_LABELS, type Venue } from "@/lib/journal/types";
import type { PickerWork } from "@/lib/work-picker/types";
import { KIND_LABELS, type WorkKind } from "@/lib/works/format";
import { startWatchedAction } from "./actions";

export interface WatchedWorkChoice {
  /** 從日誌帶入時才有：沿用那一筆，不另建 */
  journalId: string | null;
  workId: string | null;
  title: string;
  kind: WorkKind | null;
  posterUrl: string | null;
  note: string;
}

const VENUE_CHOICES: Venue[] = ["cinema", "home", "live", "exhibition", "other"];

function fromPicker(work: PickerWork): WatchedWorkChoice {
  return {
    journalId: null,
    workId: work.id,
    title: work.kind === "podcast_episode" && work.podcast_show ? work.podcast_show : work.title,
    kind: work.kind,
    posterUrl: work.poster_url,
    note: KIND_LABELS[work.kind],
  };
}

function defaultVenue(kind: WorkKind | null): Venue {
  if (kind === "movie") return "cinema";
  if (kind === "live") return "live";
  if (kind === "exhibition") return "exhibition";
  return kind ? "home" : "other";
}

function WorkButton({ work, onOpen }: { work: WatchedWorkChoice | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="watched-work"
      className="flex min-h-16 w-full items-center gap-3 rounded-[10px] border border-ink-200 bg-paper px-3 py-2.5 text-left"
    >
      {work?.kind ? (
        <span className="block h-[52px] w-9 flex-none overflow-hidden rounded">
          <WorkCover cover={{ kind: work.kind, title: work.title, posterUrl: work.posterUrl }} size="sm" className="size-full" />
        </span>
      ) : (
        <span className="block h-[52px] w-9 flex-none rounded bg-ink-50" aria-hidden="true" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[16px] font-medium text-ink-950">{work ? work.title : "選一部作品"}</span>
        <span className="text-caption text-ink-600">{work ? work.note : "電影、影集、Podcast、演出、展覽都可以"}</span>
      </span>
      <span className="text-caption text-ember-dark">{work ? "換" : "選"}</span>
    </button>
  );
}

export function WatchedForm({ prefill }: { prefill: WatchedWorkChoice | null }) {
  const router = useRouter();
  const [work, setWork] = useState<WatchedWorkChoice | null>(prefill);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [venue, setVenue] = useState<Venue>(defaultVenue(prefill?.kind ?? null));
  const [companions, setCompanions] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (mode: "voice" | "text") => {
    if (!work) {
      setError("先選一部作品");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await startWatchedAction({
        journalId: work.journalId,
        workId: work.workId,
        workTitle: work.workId ? null : work.title,
        rating,
        venue,
        companions,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const query = new URLSearchParams({ journal: result.journalId, next: "watched", ...(mode === "text" ? { mode: "text" } : {}) });
      router.push(`/say?${query.toString()}`);
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-28 lg:max-w-3xl">
      <PageHeader eyebrow="散場之後" title="看完了" description="給幾顆星，說一段，整理成一則你的 Threads。" />

      <section className="flex flex-col gap-2" aria-labelledby="watched-work-label">
        <span id="watched-work-label" className="text-caption text-ink-600">看了什麼</span>
        <WorkButton work={work} onOpen={() => setPickerOpen(true)} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-caption text-ink-600">幾顆星</span>
        <StarRating value={rating} onChange={setRating} />
        <span className="text-caption text-ink-600">再點同一顆是半顆；不打也行。只有你看得到。</span>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-caption text-ink-600">在哪裡</span>
        <div className="flex flex-wrap gap-2">
          {VENUE_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={venue === choice}
              onClick={() => setVenue(choice)}
              className={`min-h-11 rounded-full border px-4 text-caption ${
                venue === choice ? "border-ember-dark bg-ember-tint text-ember-deep" : "border-ink-200 bg-paper text-ink-700"
              }`}
            >
              {VENUE_LABELS[choice]}
            </button>
          ))}
        </div>
        <label className="mt-1 flex flex-col gap-1 text-caption text-ink-600">
          和誰一起（選填）
          <input
            value={companions}
            onChange={(event) => setCompanions(event.target.value)}
            maxLength={200}
            className="min-h-11 rounded-[10px] border border-ink-200 bg-paper px-3 text-[16px] text-ink-950"
          />
        </label>
      </section>

      {error ? (
        <p role="alert" className="m-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-3 border-t border-ink-50 pt-6">
        <button
          type="button"
          onClick={() => submit("voice")}
          disabled={pending}
          className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-ink-900 text-[16px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? "準備中…" : "說一段"}
        </button>
        <button type="button" onClick={() => submit("text")} disabled={pending} className="min-h-11 text-caption text-ink-600 underline">
          改用打字
        </button>
      </div>

      <WorkPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="看了哪一部？"
        onSelect={(picked) => {
          const choice = fromPicker(picked);
          setWork(choice);
          setVenue(defaultVenue(choice.kind));
          setPickerOpen(false);
        }}
      />
    </main>
  );
}
