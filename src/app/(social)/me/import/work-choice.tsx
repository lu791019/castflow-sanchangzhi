"use client";

/**
 * 對作品：LLM 判斷的作品名丟既有搜尋取前 3 個候選，使用者點選才算數（不自動定）。
 * 都不是 → 打開既有作品選擇器自己搜尋；演出／展覽 → 場外表單。
 */

import { useEffect, useState } from "react";
import { createWork, fetchSearch, isAbortError } from "@/components/work-picker/client";
import { Poster, ScreenRow } from "@/components/work-picker/picker-rows";
import { WorkPickerSheet } from "@/components/work-picker/work-picker-sheet";
import { candidateQuery, rankCandidates } from "@/lib/import/candidates";
import type { WorkGuess } from "@/lib/import/guess";
import { workDisplayName } from "@/lib/works/format";
import type { PickerKind, PickerWork, ScreenResult } from "@/lib/work-picker/types";
import { OnsiteForm } from "./onsite-form";

type Candidates = { status: "loading" | "ready" | "error"; items: ScreenResult[] };

function useCandidates(guess: WorkGuess | null): Candidates {
  const query = guess ? candidateQuery(guess) : null;
  const [state, setState] = useState<Candidates>({ status: query ? "loading" : "ready", items: [] });
  const kind = query?.kind;
  const text = query?.query;
  useEffect(() => {
    if (!kind || !text) return;
    const abort = new AbortController();
    fetchSearch(kind, text, abort.signal)
      .then((results) => {
        const screens = results.filter((item): item is ScreenResult => item.kind !== "podcast");
        setState({ status: "ready", items: rankCandidates(screens, { year: guess?.year ?? null }) });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ status: "error", items: [] });
      });
    return () => abort.abort();
  }, [kind, text, guess?.year]);
  return state;
}

function pickerKindOf(guess: WorkGuess | null): PickerKind {
  return guess?.kind === "series" ? "series" : guess?.kind === "podcast" ? "podcast" : "movie";
}

function GuessLine({ guess }: { guess: WorkGuess | null }) {
  if (!guess?.title) return <p className="mt-1.5 mb-0 text-caption text-ink-600">看不出在談哪一部，請自己選。</p>;
  const year = guess.year ? `（${guess.year}）` : "";
  return <p className="mt-1.5 mb-0 text-caption text-ink-600">看起來在談《{guess.title}》{year}，請確認是哪一部。</p>;
}

function ChosenWork({ work, onReset }: { work: PickerWork; onReset: () => void }) {
  const meta = [work.year ? String(work.year) : null, work.region].filter(Boolean).join("・");
  return (
    <div className="mt-3 grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 border-y border-ink-950 py-3">
      <Poster url={work.poster_url} width={40} height={60} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-eyebrow tracking-[0.14em] text-ember-dark">已選定</span>
        <span className="font-serif-tc text-prose font-bold text-ink-950">{workDisplayName(work)}</span>
        {meta ? <span className="text-caption text-ink-700">{meta}</span> : null}
      </span>
      <button type="button" onClick={onReset} className="min-h-11 text-note text-ember-dark">
        換一部
      </button>
    </div>
  );
}

export function WorkChoice({
  guess,
  chosen,
  onChosen,
}: {
  guess: WorkGuess | null;
  chosen: PickerWork | null;
  onChosen: (work: PickerWork | null) => void;
}) {
  const candidates = useCandidates(guess);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [onsite, setOnsite] = useState(guess?.kind === "live" || guess?.kind === "exhibition");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickScreen = async (item: ScreenResult) => {
    setBusy(true);
    setError(null);
    try {
      onChosen(await createWork({ source: "tmdb", kind: item.kind, tmdbId: item.tmdbId }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "建立作品失敗，再試一次");
    } finally {
      setBusy(false);
    }
  };

  if (chosen) return <ChosenWork work={chosen} onReset={() => onChosen(null)} />;

  return (
    <div role="group" aria-label="這篇在談哪一部">
      <GuessLine guess={guess} />
      {candidates.status === "loading" ? <p className="mt-3 mb-0 text-caption text-ink-600">找候選作品中…</p> : null}
      {candidates.status === "error" ? <p className="mt-3 mb-0 text-caption text-ember-deep">暫時搜不到，請自己搜尋。</p> : null}
      {candidates.items.length > 0 ? (
        <div className="mt-2 border-t border-ink-200">
          {candidates.items.map((item) => (
            <ScreenRow key={`${item.kind}-${item.tmdbId}`} item={item} query={guess?.title ?? ""} busy={busy} onPick={(picked) => void pickScreen(picked)} />
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-2 mb-0 text-caption text-ember-deep">{error}</p> : null}
      <div className="mt-1 flex flex-wrap gap-x-5">
        <button type="button" onClick={() => setSheetOpen(true)} className="min-h-11 text-note font-bold text-ember-dark">
          {candidates.items.length > 0 ? "都不是，自己搜尋" : "自己搜尋作品"}
        </button>
        <button type="button" aria-expanded={onsite} onClick={() => setOnsite(!onsite)} className="min-h-11 text-note text-ink-700">
          場外（演出／展覽）
        </button>
      </div>
      {onsite ? (
        <OnsiteForm defaultTitle={guess?.title ?? ""} defaultKind={guess?.kind === "exhibition" ? "exhibition" : "live"} onCreated={onChosen} />
      ) : null}
      <WorkPickerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={onChosen}
        initialKind={pickerKindOf(guess)}
        title="這篇在談哪一部？"
      />
    </div>
  );
}
