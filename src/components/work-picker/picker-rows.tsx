"use client";

/** 選擇器的列：電影／影集結果列、Podcast 節目列、音樂專輯列、骨架列、最近看過橫列 */

import { FallbackImg } from "@/components/ui/fallback-img";
import { splitHighlight } from "@/lib/work-picker/query";
import type { MusicAlbumResult, PickerWork, PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";

const POSTER_STRIPES =
  "bg-[repeating-linear-gradient(135deg,var(--color-ink-50)_0_5px,var(--color-paper-2)_5px_10px)]";

export function Poster({
  url,
  width,
  height,
  className = "",
}: {
  url: string | null;
  width: number;
  height: number;
  className?: string;
}) {
  const size = { width, height };
  // 沒海報或載入失敗：斜線底「海報」
  return (
    <FallbackImg
      src={url}
      style={size}
      className={`block flex-none object-cover ${className}`}
      fallback={
        <span
          style={size}
          className={`flex flex-none items-center justify-center ${POSTER_STRIPES} text-[10px] text-ink-700 ${className}`}
        >
          海報
        </span>
      }
    />
  );
}

export function HighlightedTitle({ title, query }: { title: string; query: string }) {
  return (
    <>
      {splitHighlight(title, query).map((segment, index) =>
        segment.hit ? (
          <span key={index} className="text-ember-dark">
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function FeelingBadge({ count }: { count: number }) {
  if (count <= 0) return <span />;
  return (
    <span className="text-right text-eyebrow leading-[1.5] text-ember-dark">
      已有
      <br />
      {count} 段感受
    </span>
  );
}

const ROW_CLASS =
  "grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-ink-200 py-3.5 text-left disabled:opacity-60";

export function ScreenRow({
  item,
  query,
  busy,
  onPick,
}: {
  item: ScreenResult;
  query: string;
  busy: boolean;
  onPick: (item: ScreenResult) => void;
}) {
  const meta = [item.year ? String(item.year) : null, item.region].filter(Boolean).join("・");
  return (
    <button type="button" disabled={busy} onClick={() => onPick(item)} className={ROW_CLASS}>
      <Poster url={item.posterUrl} width={48} height={72} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-serif-tc text-prose font-bold text-ink-950">
          <HighlightedTitle title={item.title} query={query} />
        </span>
        {item.originalTitle ? <span className="truncate text-caption text-ink-600">{item.originalTitle}</span> : null}
        {meta ? <span className="text-caption text-ink-700">{meta}</span> : null}
      </span>
      <FeelingBadge count={item.feelingCount} />
    </button>
  );
}

export function PodcastShowRow({
  item,
  query,
  onPick,
}: {
  item: PodcastShowResult;
  query: string;
  onPick: (item: PodcastShowResult) => void;
}) {
  const meta = [item.artist, item.trackCount ? `${item.trackCount} 集` : null].filter(Boolean).join("・");
  return (
    <button type="button" onClick={() => onPick(item)} className={ROW_CLASS}>
      <Poster url={item.artworkUrl} width={48} height={48} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-serif-tc text-prose font-bold text-ink-950">
          <HighlightedTitle title={item.name} query={query} />
        </span>
        {meta ? <span className="truncate text-caption text-ink-700">{meta}</span> : null}
      </span>
      <span className="text-eyebrow text-ink-600">選集數 ›</span>
    </button>
  );
}

/** 專輯列：方形封面＋歌手・年份・曲數；點了直接選定（沒有第二層） */
export function MusicAlbumRow({
  item,
  query,
  busy,
  onPick,
}: {
  item: MusicAlbumResult;
  query: string;
  busy: boolean;
  onPick: (item: MusicAlbumResult) => void;
}) {
  const meta = [item.artist, item.year ? String(item.year) : null, item.trackCount === 1 ? "單曲" : item.trackCount ? `${item.trackCount} 首` : null]
    .filter(Boolean)
    .join("・");
  return (
    <button type="button" disabled={busy} onClick={() => onPick(item)} className={ROW_CLASS}>
      <Poster url={item.artworkUrl} width={48} height={48} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-serif-tc text-prose font-bold text-ink-950">
          <HighlightedTitle title={item.title} query={query} />
        </span>
        {meta ? <span className="truncate text-caption text-ink-700">{meta}</span> : null}
      </span>
      <FeelingBadge count={item.feelingCount} />
    </button>
  );
}

const SKELETON_WIDTHS = [
  ["62%", "40%", "52%"],
  ["48%", "34%", "58%"],
  ["70%", "44%", "46%"],
  ["54%", "30%", "60%"],
];

/** 載入中：paper-2 骨架列，不轉圈 */
export function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="載入中">
      <p className="mt-3 mb-0 text-eyebrow tracking-[0.1em] text-ink-600">正在翻索引…</p>
      {SKELETON_WIDTHS.map((widths, index) => (
        <div
          key={index}
          className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-3.5 border-b border-ink-50 py-3.5"
        >
          <span className="block h-[72px] w-12 bg-paper-2" />
          <span className="flex flex-col gap-2.5">
            <span className="block h-3.5 bg-paper-2" style={{ width: widths[0] }} />
            <span className="block h-2.5 bg-paper-2" style={{ width: widths[1] }} />
            <span className="block h-2.5 bg-paper-2" style={{ width: widths[2] }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function RecentCard({ pick, onPick }: { pick: PickerWork; onPick: (pick: PickerWork) => void }) {
  const podcast = pick.kind === "podcast_episode";
  const music = pick.kind === "music";
  const label = podcast && pick.podcast_show ? pick.podcast_show : pick.title;
  return (
    <button type="button" onClick={() => onPick(pick)} className="flex w-[72px] flex-none flex-col gap-1.5 text-left">
      {music ? (
        <Poster url={pick.poster_url} width={72} height={72} />
      ) : podcast && !pick.poster_url ? (
        <span className="flex h-[108px] w-[72px] justify-center border-t-2 border-b border-ink-950 bg-paper-2 pt-2">
          <span className="font-serif-tc text-lede font-bold tracking-[0.1em] text-ink-950 [writing-mode:vertical-rl]">
            {label}
          </span>
        </span>
      ) : (
        <Poster url={pick.poster_url} width={72} height={108} />
      )}
      <span className="line-clamp-3 text-caption leading-[1.4] text-ink-950">
        {label}
        {podcast ? (
          <>
            <br />
            <span className="text-ink-600">
              {pick.episode_number ? `第 ${pick.episode_number} 集` : pick.title}
            </span>
          </>
        ) : music && pick.credit ? (
          <>
            <br />
            <span className="text-ink-600">{pick.credit}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}

/** 「最近說過的」橫向小海報列（≤ 6） */
export function RecentStrip({
  picks,
  loading,
  onPick,
}: {
  picks: PickerWork[];
  loading: boolean;
  onPick: (pick: PickerWork) => void;
}) {
  return (
    <div className="pt-[22px]">
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ink-600">最近說過的</span>
      {loading ? (
        <div className="mt-3 flex gap-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <span key={index} className="block h-[108px] w-[72px] flex-none bg-paper-2" />
          ))}
        </div>
      ) : picks.length > 0 ? (
        <div className="-mr-4 mt-3 flex gap-3 overflow-x-auto pr-4 [scrollbar-width:none]">
          {picks.map((pick) => (
            <RecentCard key={pick.id} pick={pick} onPick={onPick} />
          ))}
        </div>
      ) : (
        <p className="mt-3 mb-0 text-caption leading-[1.8] text-ink-600">還沒說過任何作品。</p>
      )}
      {/* 沒有最近的作品時不說「就在上面這一排」（指向空白，UX-14） */}
      {loading || picks.length > 0 ? (
        <p className="mt-10 mb-0 font-serif-tc text-prose leading-[1.8] text-ink-700">
          剛看完的那一部，
          <br />
          通常就在上面這一排。
        </p>
      ) : null}
      <p className="mt-2 mb-0 text-caption leading-[1.8] text-ink-600">也可以輸入原文片名，或 Podcast 節目名稱。</p>
    </div>
  );
}
