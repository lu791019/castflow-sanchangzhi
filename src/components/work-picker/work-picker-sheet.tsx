"use client";

/**
 * 作品選擇器：全螢幕底部 sheet（上緣留 48px）。校樣頁與說一段頁共用。
 * 把手＋「這篇在說哪一部？」＋關閉 → 類型 tab → 髮絲線搜尋框 → 內容（A–E 五態）→ 底部 TMDB 標註。
 * 每次打開都重新掛載 panel：狀態從頭開始，不需要在效應裡重設。
 */

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useRef, useState } from "react";
import type { WorkKind } from "@/lib/works/format";
import {
  PICKER_KINDS,
  PICKER_KIND_LABELS,
  type CreateWorkInput,
  type MusicAlbumResult,
  type PickerKind,
  type PickerWork,
  type PodcastEpisodeOption,
  type PodcastShowResult,
  type ScreenResult,
} from "@/lib/work-picker/types";
import { createWork, fetchRecent, isAbortError } from "./client";
import { PickerBody } from "./picker-body";
import { useTrending } from "./use-trending";
import { useWorkSearch } from "./use-work-search";

export interface WorkPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** 選定（已建立或取回 works 列）後呼叫；sheet 會自行關閉 */
  onSelect: (work: PickerWork) => void;
  initialKind?: PickerKind;
  /** 面板標題；預設是校樣／說一段的問法 */
  title?: string;
}

const PLACEHOLDERS: Record<PickerKind, string> = {
  movie: "片名、原文片名…",
  series: "劇名、原文劇名…",
  podcast: "節目名稱…",
  music: "專輯名、歌手…",
};

const SOURCE_NOTES: Record<PickerKind, string> = {
  movie: "影劇資料來源：TMDB",
  series: "影劇資料來源：TMDB",
  podcast: "Podcast 資料來源：Apple Podcasts",
  music: "音樂資料來源：Apple Music",
};

function CrossIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** 掛載即開始抓「最近說過的」；初始 loading，效應只在回呼內 setState */
function useRecentWorks(): { recent: PickerWork[]; loading: boolean } {
  const [state, setState] = useState<{ recent: PickerWork[]; loading: boolean }>({ recent: [], loading: true });
  useEffect(() => {
    const abort = new AbortController();
    fetchRecent(abort.signal)
      .then((recent) => setState({ recent, loading: false }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error("[work-picker] recent failed", error instanceof Error ? error.message : error);
        setState({ recent: [], loading: false });
      });
    return () => abort.abort();
  }, []);
  return state;
}

function KindTabs({ kind, onChange }: { kind: PickerKind; onChange: (kind: PickerKind) => void }) {
  return (
    <nav aria-label="類型" className="mx-4 mt-1 flex gap-[22px] border-b border-ink-200">
      {PICKER_KINDS.map((option) => {
        const active = option === kind;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`flex min-h-11 items-center text-note ${
              active ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
            }`}
          >
            {PICKER_KIND_LABELS[option]}
          </button>
        );
      })}
    </nav>
  );
}

function SearchField({
  kind,
  query,
  inputRef,
  onChange,
}: {
  kind: PickerKind;
  query: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mx-4 mt-2 flex min-h-[52px] items-center gap-2.5 border-b border-ink-950 text-ink-700">
      <SearchIcon />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label="搜尋作品"
        placeholder={PLACEHOLDERS[kind]}
        value={query}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 font-serif-tc text-prose text-ink-950 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          aria-label="清除"
          onClick={() => onChange("")}
          className="-mr-3 flex size-11 items-center justify-center text-ink-600"
        >
          <CrossIcon size={16} />
        </button>
      ) : null}
    </label>
  );
}

function PickerPanel({
  onClose,
  onSelect,
  initialKind,
  title,
}: {
  onClose: () => void;
  onSelect: (work: PickerWork) => void;
  initialKind: PickerKind;
  title: string;
}) {
  const [kind, setKind] = useState<PickerKind>(initialKind);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<PodcastShowResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useWorkSearch(kind, query, retryToken);
  const { recent, loading: recentLoading } = useRecentWorks();
  const trending = useTrending(kind);

  const switchKind = (next: PickerKind) => {
    setKind(next);
    setShow(null);
    setPickError(null);
  };

  const finish = (work: PickerWork) => {
    onSelect(work);
    onClose();
  };

  const commit = async (input: CreateWorkInput) => {
    setBusy(true);
    setPickError(null);
    try {
      finish(await createWork(input));
    } catch (error) {
      setPickError(error instanceof Error ? error.message : "建立作品失敗，再試一次");
      setBusy(false);
    }
  };

  const onPickScreen = (item: ScreenResult) => commit({ source: "tmdb", kind: item.kind, tmdbId: item.tmdbId });
  const onPickEpisode = (picked: PodcastShowResult, episode: PodcastEpisodeOption) =>
    commit({ source: "podcast", feedUrl: picked.feedUrl, guid: episode.guid, itunesId: picked.itunesId });
  const onPickAlbum = (album: MusicAlbumResult) => commit({ source: "music", itunesId: album.itunesId });
  const onManual = (input: { kind: WorkKind; title: string }) => commit({ source: "manual", ...input });

  const showSearch = !(kind === "podcast" && show);

  return (
    <Dialog.Popup
      initialFocus={inputRef}
      aria-label="選擇作品"
      className="fixed inset-x-0 top-12 bottom-0 z-50 flex flex-col rounded-t-[4px] bg-paper text-ink-900 outline-none transition duration-200 ease-in-out data-ending-style:translate-y-10 data-ending-style:opacity-0 data-starting-style:translate-y-10 data-starting-style:opacity-0"
    >
      <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-sm bg-ink-300" />
      <div className="flex items-center justify-between pt-1.5 pr-2 pl-4">
        <Dialog.Title className="m-0 font-serif-tc text-section font-bold text-ink-950">{title}</Dialog.Title>
        <Dialog.Close aria-label="關閉" className="flex size-11 items-center justify-center text-ink-700">
          <CrossIcon size={20} />
        </Dialog.Close>
      </div>

      <KindTabs kind={kind} onChange={switchKind} />
      {showSearch ? <SearchField kind={kind} query={query} inputRef={inputRef} onChange={setQuery} /> : null}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
        <PickerBody
          kind={kind}
          search={search}
          show={show}
          recent={recent}
          recentLoading={recentLoading}
          trending={trending}
          busy={busy}
          pickError={pickError}
          onRetry={() => setRetryToken((token) => token + 1)}
          onPickRecent={finish}
          onPickScreen={onPickScreen}
          onPickShow={setShow}
          onPickAlbum={onPickAlbum}
          onBackToShows={() => setShow(null)}
          onPickEpisode={onPickEpisode}
          onManual={onManual}
        />
        {pickError && search.results.length > 0 ? (
          <p className="mt-3 mb-0 text-caption text-ember-deep" role="alert">
            {pickError}
          </p>
        ) : null}
      </div>

      <p className="m-0 border-t border-ink-50 px-4 pt-2.5 pb-[18px] text-eyebrow text-ink-600">
        {SOURCE_NOTES[kind]}
      </p>
    </Dialog.Popup>
  );
}

export function WorkPickerSheet({ open, onClose, onSelect, initialKind = "movie", title = "這篇在說哪一部？" }: WorkPickerSheetProps) {
  if (!open) return null;
  return (
    <Dialog.Root open onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-scrim transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <PickerPanel onClose={onClose} onSelect={onSelect} initialKind={initialKind} title={title} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}
