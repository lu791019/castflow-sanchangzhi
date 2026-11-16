/** 選定後要寫進 works 的列（純轉換）與批次查詢的小工具 */

import { pickPodcastCover } from "@/lib/covers/cover";
import type { FeedItem, ParsedFeed } from "@/lib/ingest/rss-parse";
import type { WorkKind } from "@/lib/works/format";
import { manualSlug, musicSlug, podcastSlug, tmdbSlug } from "./slug";
import type { TmdbDetail } from "./tmdb";
import type { MusicAlbumResult } from "./types";

/** works insert 欄位（不含 id / issue_no / created_at / synopsis） */
export interface WorkInsert {
  kind: WorkKind;
  title: string;
  original_title: string | null;
  year: number | null;
  region: string | null;
  credit: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  podcast_show: string | null;
  episode_number: number | null;
  slug: string;
  feed_url: string | null;
  itunes_id: number | null;
  episode_guid: string | null;
  /** 演出／展覽（migration 014）；其他類型省略 */
  venue?: string | null;
  event_date?: string | null;
  /** 電影片長（分，migration 032）；沒有就省略 */
  runtime_minutes?: number;
}

const YEAR_MIN = 1880;
const YEAR_MAX = 2100;

/** works_year_range 之外的年份不讓 DB 拒絕，存 null */
function safeYear(year: number | null): number | null {
  return year !== null && year >= YEAR_MIN && year <= YEAR_MAX ? year : null;
}

export function tmdbWorkInsert(detail: TmdbDetail): WorkInsert {
  return {
    kind: detail.kind,
    title: detail.title,
    original_title: detail.originalTitle,
    year: safeYear(detail.year),
    region: detail.region,
    credit: detail.credit,
    poster_url: detail.posterUrl,
    tmdb_id: detail.tmdbId,
    podcast_show: null,
    episode_number: null,
    slug: tmdbSlug(detail.kind, detail.tmdbId),
    feed_url: null,
    itunes_id: null,
    episode_guid: null,
    ...(detail.runtimeMinutes ? { runtime_minutes: detail.runtimeMinutes } : {}),
  };
}

export interface PodcastWorkSource {
  feedUrl: string;
  show: Pick<ParsedFeed, "title" | "imageUrl" | "author">;
  item: FeedItem;
  itunesId: number | null;
  /** iTunes lookup 的 artworkUrl600；沒查到或查失敗為 null（退回 RSS 的 itunes:image） */
  artworkUrl?: string | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function yearOfDate(raw: string | null): number | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

export function podcastWorkInsert({ feedUrl, show, item, itunesId, artworkUrl = null }: PodcastWorkSource): WorkInsert {
  return {
    kind: "podcast_episode",
    title: item.title,
    original_title: null,
    year: safeYear(yearOfDate(item.publishedAt)),
    region: null,
    credit: item.author ?? show.author,
    poster_url: pickPodcastCover(artworkUrl, show.imageUrl),
    tmdb_id: null,
    podcast_show: show.title ?? hostOf(feedUrl),
    episode_number: item.episodeNumber,
    slug: podcastSlug(feedUrl, item.guid),
    feed_url: feedUrl,
    itunes_id: itunesId,
    episode_guid: item.guid,
  };
}

/** 專輯（iTunes lookup 取回的標準資料）→ music 列：credit＝歌手／樂團、poster＝專輯封面 */
export function musicWorkInsert(album: MusicAlbumResult): WorkInsert {
  return {
    kind: "music",
    title: album.title,
    original_title: null,
    year: safeYear(album.year),
    region: null,
    credit: album.artist,
    poster_url: album.artworkUrl,
    tmdb_id: null,
    podcast_show: null,
    episode_number: null,
    slug: musicSlug(album.itunesId),
    feed_url: null,
    itunes_id: album.itunesId,
    episode_guid: null,
  };
}

export function manualWorkInsert(
  input: { kind: WorkKind; title: string; venue?: string | null; eventDate?: string | null },
  nonce: number,
): WorkInsert {
  const onSite = input.kind === "live" || input.kind === "exhibition";
  return {
    ...(onSite ? { venue: input.venue ?? null, event_date: input.eventDate ?? null } : {}),
    kind: input.kind,
    title: input.title,
    original_title: null,
    year: null,
    region: null,
    credit: null,
    poster_url: null,
    tmdb_id: null,
    podcast_show: null,
    episode_number: null,
    slug: manualSlug(input.kind, input.title, nonce),
    feed_url: null,
    itunes_id: null,
    episode_guid: null,
  };
}

/** 去重保序（略過 null），取前 limit 個 */
export function uniqueInOrder(ids: Array<string | null>, limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (id === null || seen.has(id) || result.length >= limit) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/** episodes 列 → { work_id: 筆數 } */
export function countByWorkId(rows: Array<{ work_id: string }>): Record<string, number> {
  return rows.reduce<Record<string, number>>(
    (acc, row) => ({ ...acc, [row.work_id]: (acc[row.work_id] ?? 0) + 1 }),
    {},
  );
}
