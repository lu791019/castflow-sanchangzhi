"use client";

/** 狀態 C：Podcast 節目 → 選集數（麵包屑「Podcast › 節目名 › 選集數」） */

import { useEffect, useState } from "react";
import { formatChapterLength } from "@/lib/listen/duration";
import { episodeLabel, formatShortDate } from "@/lib/work-picker/episodes";
import type {
  PodcastEpisodeOption,
  PodcastEpisodesPayload,
  PodcastShowResult,
} from "@/lib/work-picker/types";
import { fetchEpisodes, isAbortError } from "./client";
import { Poster } from "./picker-rows";

type EpisodesState =
  | { status: "loading" }
  | { status: "ready"; payload: PodcastEpisodesPayload }
  | { status: "error"; message: string };

/** 以 key（feedUrl + 重試次數）重新掛載，初始即 loading；效應只在回呼內 setState */
function useEpisodes(feedUrl: string): EpisodesState {
  const [state, setState] = useState<EpisodesState>({ status: "loading" });
  useEffect(() => {
    const abort = new AbortController();
    fetchEpisodes(feedUrl, abort.signal)
      .then((payload) => setState({ status: "ready", payload }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "暫時讀不到集數" });
      });
    return () => abort.abort();
  }, [feedUrl]);
  return state;
}

function EpisodeRow({
  episode,
  latest,
  busy,
  onPick,
}: {
  episode: PodcastEpisodeOption;
  latest: boolean;
  busy: boolean;
  onPick: (episode: PodcastEpisodeOption) => void;
}) {
  const label = episodeLabel(episode);
  const sub = [
    episode.episodeNumber ? formatShortDate(episode.publishedAt) : null,
    episode.durationSeconds ? formatChapterLength(episode.durationSeconds) : null,
  ]
    .filter(Boolean)
    .join("・");
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onPick(episode)}
      className="grid w-full grid-cols-[minmax(40px,auto)_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-ink-200 py-3.5 text-left disabled:opacity-60"
    >
      <span
        className={`font-serif-tc text-lede font-bold tabular-nums ${latest ? "text-ember-dark" : "text-ink-600"}`}
      >
        {label}
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className={`font-serif-tc text-prose text-ink-950 ${latest ? "font-bold" : ""}`}>{episode.title}</span>
        {sub ? <span className="text-caption text-ink-600">{sub}</span> : null}
      </span>
      {episode.feelingCount > 0 ? (
        <span className="text-eyebrow text-ember-dark">已有 {episode.feelingCount} 段</span>
      ) : latest ? (
        <span className="text-eyebrow text-ink-600">最新</span>
      ) : (
        <span />
      )}
    </button>
  );
}

function EpisodeSkeleton() {
  return (
    <div aria-busy="true" aria-label="載入集數中">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-b border-ink-50 py-3.5">
          <span className="block h-3.5 w-8 bg-paper-2" />
          <span className="flex flex-col gap-2.5">
            <span className="block h-3.5 w-[64%] bg-paper-2" />
            <span className="block h-2.5 w-[32%] bg-paper-2" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function PodcastEpisodes({
  show,
  busy,
  onBack,
  onPick,
}: {
  show: PodcastShowResult;
  busy: boolean;
  onBack: () => void;
  onPick: (show: PodcastShowResult, episode: PodcastEpisodeOption) => void;
}) {
  const [retryToken, setRetryToken] = useState(0);
  return (
    <EpisodeList
      key={`${show.feedUrl}\u0000${retryToken}`}
      show={show}
      busy={busy}
      onBack={onBack}
      onPick={onPick}
      onRetry={() => setRetryToken((token) => token + 1)}
    />
  );
}

function EpisodeList({
  show,
  busy,
  onBack,
  onPick,
  onRetry,
}: {
  show: PodcastShowResult;
  busy: boolean;
  onBack: () => void;
  onPick: (show: PodcastShowResult, episode: PodcastEpisodeOption) => void;
  onRetry: () => void;
}) {
  const state = useEpisodes(show.feedUrl);
  const ready = state.status === "ready" ? state.payload : null;
  const meta = [show.artist, show.trackCount ? `${show.trackCount} 集` : null].filter(Boolean).join("・");

  return (
    <div>
      <nav aria-label="位置" className="flex min-h-11 items-center gap-1.5 text-caption text-ink-600">
        <button type="button" onClick={onBack} className="text-ink-700">
          Podcast
        </button>
        <span>›</span>
        <button type="button" onClick={onBack} className="max-w-[40%] truncate text-ink-700">
          {show.name}
        </button>
        <span>›</span>
        <span className="font-bold text-ink-950">選集數</span>
      </nav>
      <div className="flex items-center gap-3.5 border-b border-ink-950 pt-3 pb-4">
        <Poster url={ready?.show.imageUrl ?? show.artworkUrl} width={56} height={56} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-serif-tc text-prose font-bold text-ink-950">{ready?.show.title ?? show.name}</span>
          {meta ? <span className="truncate text-caption text-ink-700">{meta}</span> : null}
        </span>
      </div>
      {state.status === "loading" ? <EpisodeSkeleton /> : null}
      {state.status === "error" ? (
        <div className="pt-6">
          <p className="m-0 font-serif-tc text-prose leading-[1.7] font-bold text-ink-950">{state.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 flex min-h-11 items-center rounded-[4px] border border-ink-950 px-4 text-note font-bold text-ink-950"
          >
            再試一次
          </button>
        </div>
      ) : null}
      {ready
        ? ready.episodes.map((episode, index) => (
            <EpisodeRow
              key={episode.guid}
              episode={episode}
              latest={index === 0}
              busy={busy}
              onPick={(picked) => onPick(show, picked)}
            />
          ))
        : null}
    </div>
  );
}
