/**
 * 作品選擇器的 server 流程：搜尋（TMDB / iTunes）、Podcast 選集數（RSS）、選定後建立或取回 work。
 * 外部 API 失敗一律往上拋 PickerUpstreamError，route 回 502 + 使用者看得到的訊息；不靜默降級。
 * 新建音樂、Podcast 作品後排一次 Spotify 自動直連（Q-64 A②，回應送出後才搜，失敗不影響建立）。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { fetchFeedXml } from "@/lib/ingest/rss";
import { parseFeed, type ParsedFeed } from "@/lib/ingest/rss-parse";
import { RssIngestError } from "@/lib/ingest/rss-errors";
import { findEpisodeByGuid, toEpisodeOptions } from "./episodes";
import {
  createTtlCache,
  itunesDepsFromEnv,
  itunesLookupDepsFromEnv,
  lookupPodcastArtwork,
  searchPodcasts,
  ItunesError,
} from "./itunes";
import { lookupAlbum, musicLookupDepsFromEnv, musicSearchDepsFromEnv, searchAlbums } from "./itunes-music";
import {
  claimLegacyWork,
  feelingCountsByFeed,
  feelingCountsByMusic,
  feelingCountsByTmdb,
  findBySlug,
  findWorkByMusicId,
  findWorkByPodcastKey,
  findWorkByTmdb,
  insertWork,
} from "./repository";
import { scheduleSpotifyAutoLink } from "@/lib/links/spotify-auto-repository";
import { liveInputFromManual } from "@/lib/venue/input";
import { findOrCreateLiveWork } from "@/lib/venue/repository";
import { fetchTmdbDetail, searchTmdb, tmdbDepsFromEnv, TmdbError } from "./tmdb";
import type {
  CreateWorkInput,
  MusicAlbumResult,
  PickerKind,
  PickerWork,
  PodcastEpisodesPayload,
  SearchResult,
} from "./types";
import { manualWorkInsert, musicWorkInsert, podcastWorkInsert, tmdbWorkInsert } from "./work-rows";

export const UPSTREAM_ERROR_MESSAGE = "暫時搜不到，再試一次";

export class PickerUpstreamError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = "PickerUpstreamError";
  }
}

export class PickerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PickerNotFoundError";
  }
}

function logUpstream(scope: string, context: Record<string, unknown>, error: unknown): void {
  const detail =
    error instanceof TmdbError || error instanceof ItunesError
      ? { name: error.name, status: error.status, message: error.message }
      : error instanceof RssIngestError
        ? { name: error.name, code: error.code, message: error.message }
        : { message: error instanceof Error ? error.message : String(error) };
  console.error(`[work-picker] ${scope} upstream failed`, { ...context, ...detail });
}

/** 專輯補自家感受數（音樂榜單也用） */
export async function withMusicFeelingCounts(albums: readonly MusicAlbumResult[]): Promise<MusicAlbumResult[]> {
  const counts = await feelingCountsByMusic(albums.map((album) => album.itunesId));
  return albums.map((album) => ({ ...album, feelingCount: counts[album.itunesId] ?? 0 }));
}

async function searchMusic(query: string): Promise<MusicAlbumResult[]> {
  let albums;
  try {
    albums = await searchAlbums(query, musicSearchDepsFromEnv());
  } catch (error) {
    logUpstream("searchAlbums", { query }, error);
    throw new PickerUpstreamError(UPSTREAM_ERROR_MESSAGE, error);
  }
  return withMusicFeelingCounts(albums);
}

/** 電影／影集走 TMDB 並補自家感受數；Podcast、音樂走 iTunes */
export async function searchWorks(kind: PickerKind, query: string): Promise<SearchResult[]> {
  if (kind === "music") return searchMusic(query);
  if (kind === "podcast") {
    try {
      return await searchPodcasts(query, itunesDepsFromEnv());
    } catch (error) {
      logUpstream("searchPodcasts", { query }, error);
      throw new PickerUpstreamError(UPSTREAM_ERROR_MESSAGE, error);
    }
  }
  let results;
  try {
    results = await searchTmdb(kind, query, tmdbDepsFromEnv());
  } catch (error) {
    logUpstream("searchTmdb", { kind, query }, error);
    throw new PickerUpstreamError(UPSTREAM_ERROR_MESSAGE, error);
  }
  const counts = await feelingCountsByTmdb(kind, results.map((item) => item.tmdbId));
  return results.map((item) => ({ ...item, feelingCount: counts[item.tmdbId] ?? 0 }));
}

const FEED_CACHE_TTL_MS = 10 * 60_000;
const feedCache = createTtlCache<ParsedFeed>(FEED_CACHE_TTL_MS);

async function loadFeed(feedUrl: string): Promise<ParsedFeed> {
  const cached = feedCache.get(feedUrl);
  if (cached) return cached;
  try {
    const feed = parseFeed(await fetchFeedXml(feedUrl));
    feedCache.set(feedUrl, feed);
    return feed;
  } catch (error) {
    logUpstream("loadFeed", { feedUrl }, error);
    throw new PickerUpstreamError("暫時讀不到這個節目的集數，再試一次", error);
  }
}

/** Podcast 第二層：節目 RSS → 集數列表（含自家感受數） */
export async function loadPodcastEpisodes(feedUrl: string): Promise<PodcastEpisodesPayload> {
  const [feed, counts] = await Promise.all([loadFeed(feedUrl), feelingCountsByFeed(feedUrl)]);
  return {
    show: { title: feed.title, author: feed.author, imageUrl: feed.imageUrl, feedUrl },
    episodes: toEpisodeOptions(feed, counts),
  };
}

async function resolveTmdbWork(input: Extract<CreateWorkInput, { source: "tmdb" }>): Promise<PickerWork> {
  const existing = await findWorkByTmdb(input.kind, input.tmdbId);
  if (existing) return existing;
  let detail;
  try {
    detail = await fetchTmdbDetail(input.kind, input.tmdbId, tmdbDepsFromEnv());
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) throw new PickerNotFoundError("TMDB 找不到這部作品");
    logUpstream("fetchTmdbDetail", input, error);
    throw new PickerUpstreamError("暫時抓不到作品資料，再試一次", error);
  }
  const row = tmdbWorkInsert(detail);
  const claimed = await claimLegacyWork(row);
  return claimed ?? insertWork(row);
}

/** 節目封面優先用 iTunes 600；查不到或上游失敗退回 RSS 的 itunes:image（失敗推警報，不擋建立作品） */
async function lookupArtworkOrFallback(itunesId: number | null, feedUrl: string): Promise<string | null> {
  if (itunesId === null) return null;
  try {
    return await lookupPodcastArtwork(itunesId, itunesLookupDepsFromEnv());
  } catch (error) {
    logUpstream("lookupPodcastArtwork", { itunesId, feedUrl }, error);
    const detail = `itunes_id=${itunesId} feed=${feedUrl}：${error instanceof Error ? error.message : String(error)}`;
    void getServerNotify()("warn", "Podcast 封面：iTunes lookup 失敗，退回 RSS 封面", detail).catch(() => undefined);
    return null;
  }
}

async function resolvePodcastWork(
  input: Extract<CreateWorkInput, { source: "podcast" }>,
): Promise<PickerWork> {
  const existing = await findWorkByPodcastKey(input.feedUrl, input.guid);
  if (existing) return existing;
  const feed = await loadFeed(input.feedUrl);
  const item = findEpisodeByGuid(feed, input.guid);
  if (!item) throw new PickerNotFoundError("這個節目裡找不到這一集");
  const artworkUrl = await lookupArtworkOrFallback(input.itunesId, input.feedUrl);
  const work = await insertWork(podcastWorkInsert({ feedUrl: input.feedUrl, show: feed, item, itunesId: input.itunesId, artworkUrl }));
  scheduleSpotifyAutoLink(work);
  return work;
}

/** 專輯：同 itunes_id 已建過就回既有；否則向 iTunes lookup 取回標準資料再建 */
async function resolveMusicWork(input: Extract<CreateWorkInput, { source: "music" }>): Promise<PickerWork> {
  const existing = await findWorkByMusicId(input.itunesId);
  if (existing) return existing;
  let album;
  try {
    album = await lookupAlbum(input.itunesId, musicLookupDepsFromEnv());
  } catch (error) {
    logUpstream("lookupAlbum", input, error);
    throw new PickerUpstreamError("暫時抓不到專輯資料，再試一次", error);
  }
  if (!album) throw new PickerNotFoundError("iTunes 找不到這張專輯");
  const work = await insertWork(musicWorkInsert(album));
  scheduleSpotifyAutoLink({ ...work, trackCount: album.trackCount });
  return work;
}

/** 手動輸入：演出／展覽依名稱＋日期歸入既有場刊（同記一筆場外變體），其他照舊新建 */
async function resolveManualWork(input: Extract<CreateWorkInput, { source: "manual" }>): Promise<PickerWork> {
  const live = liveInputFromManual(input, new Date());
  if (!live) return insertWork(manualWorkInsert(input, Date.now()));
  const ref = await findOrCreateLiveWork(live);
  const work = await findBySlug(ref.slug);
  if (!work) throw new Error("讀取場刊失敗");
  return work;
}

/** 選定 → 回既有 work 或新建（同 tmdb / 同集不重複建） */
export async function resolveWork(input: CreateWorkInput): Promise<PickerWork> {
  switch (input.source) {
    case "tmdb":
      return resolveTmdbWork(input);
    case "podcast":
      return resolvePodcastWork(input);
    case "music":
      return resolveMusicWork(input);
    case "manual":
      return resolveManualWork(input);
  }
}
