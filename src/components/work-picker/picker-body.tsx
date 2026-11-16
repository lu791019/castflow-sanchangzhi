"use client";

/** sheet 內容區：依搜尋狀態切 A（最近＋本週熱門）/ B（結果）/ C（選集數）/ D（查無＋手動）/ E（骨架） */

import type { WorkKind } from "@/lib/works/format";
import type {
  MusicAlbumResult,
  PickerKind,
  PickerWork,
  PodcastEpisodeOption,
  PodcastShowResult,
  ScreenResult,
} from "@/lib/work-picker/types";
import { ManualEntry } from "./manual-form";
import { PodcastEpisodes } from "./podcast-episodes";
import { MusicAlbumRow, PodcastShowRow, RecentStrip, ScreenRow, SkeletonRows } from "./picker-rows";
import { TrendingSections } from "./trending-sections";
import type { TrendingState } from "./use-trending";
import type { SearchState } from "./use-work-search";

export interface PickerBodyProps {
  kind: PickerKind;
  search: SearchState;
  show: PodcastShowResult | null;
  recent: PickerWork[];
  recentLoading: boolean;
  trending: TrendingState;
  busy: boolean;
  pickError: string | null;
  onRetry: () => void;
  onPickRecent: (work: PickerWork) => void;
  onPickScreen: (item: ScreenResult) => void;
  onPickShow: (show: PodcastShowResult) => void;
  onPickAlbum: (album: MusicAlbumResult) => void;
  onBackToShows: () => void;
  onPickEpisode: (show: PodcastShowResult, episode: PodcastEpisodeOption) => void;
  onManual: (input: { kind: WorkKind; title: string }) => void;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 mb-0 font-serif-tc text-prose leading-[1.8] text-ink-700">{children}</p>;
}

/** 錯誤 3・搜不到／服務不通：不是使用者打錯字；保留「手動輸入名稱」這條路 */
function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pt-5">
      <div aria-hidden="true" className="p2-manuscript h-[61px] w-full max-w-[331px]" />
      <h2 className="mt-[18px] mb-0 font-serif-tc text-section font-bold text-ink-950">暫時搜不到，再試一次。</h2>
      <p role="status" className="mt-1.5 mb-0 text-note leading-[1.8] text-ink-700">
        作品資料庫這會兒連不上，不是你打錯字。
      </p>
      {message && message !== "暫時搜不到，再試一次" ? <p className="mt-1 mb-0 text-caption text-ink-600">{message}</p> : null}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-[4px] border border-ink-950 px-[18px] text-note font-bold text-ink-950"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.3-5.6" />
          <path d="M20 4v5h-5" />
        </svg>
        再試一次
      </button>
      <div aria-hidden="true" className="mt-[26px] flex items-center gap-3">
        <span className="block h-px flex-1 bg-ink-200" />
        <span className="text-eyebrow tracking-[0.2em] text-ink-600">或者</span>
        <span className="block h-px flex-1 bg-ink-200" />
      </div>
    </div>
  );
}

function ResultList({
  kind,
  search,
  busy,
  onPickScreen,
  onPickShow,
  onPickAlbum,
}: Pick<PickerBodyProps, "kind" | "search" | "busy" | "onPickScreen" | "onPickShow" | "onPickAlbum">) {
  return (
    <div>
      <p className="mt-3 mb-0 text-eyebrow tracking-[0.1em] text-ink-600">
        「{search.query}」・{search.results.length} 筆結果
      </p>
      {search.results.map((item) =>
        item.kind === "podcast" ? (
          <PodcastShowRow key={item.itunesId} item={item} query={search.query} onPick={onPickShow} />
        ) : item.kind === "music" ? (
          <MusicAlbumRow key={`music-${item.itunesId}`} item={item} query={search.query} busy={busy} onPick={onPickAlbum} />
        ) : (
          <ScreenRow
            key={`${kind}-${item.tmdbId}`}
            item={item}
            query={search.query}
            busy={busy}
            onPick={onPickScreen}
          />
        ),
      )}
    </div>
  );
}

export function PickerBody(props: PickerBodyProps) {
  const { kind, search, show, pickError } = props;

  if (kind === "podcast" && show) {
    return (
      <PodcastEpisodes show={show} busy={props.busy} onBack={props.onBackToShows} onPick={props.onPickEpisode} />
    );
  }

  switch (search.status) {
    case "empty":
      return (
        <>
          <RecentStrip picks={props.recent} loading={props.recentLoading} onPick={props.onPickRecent} />
          <TrendingSections
            trending={props.trending}
            busy={props.busy}
            onPickScreen={props.onPickScreen}
            onPickShow={props.onPickShow}
            onPickAlbum={props.onPickAlbum}
          />
        </>
      );
    case "too_short":
      return <Hint>再多打一個字，就開始找。</Hint>;
    case "loading":
      return <SkeletonRows />;
    case "error":
      return (
        <>
          <ErrorBlock message={search.error ?? ""} onRetry={props.onRetry} />
          <ManualEntry
            key={`unavailable-${search.query}`}
            query={search.query}
            defaultKind={kind}
            busy={props.busy}
            error={pickError}
            onSubmit={props.onManual}
            unavailable
          />
        </>
      );
    case "ready":
      if (search.results.length === 0) {
        return (
          <ManualEntry
            key={search.query}
            query={search.query}
            defaultKind={kind}
            busy={props.busy}
            error={pickError}
            onSubmit={props.onManual}
          />
        );
      }
      return <ResultList {...props} />;
  }
}
