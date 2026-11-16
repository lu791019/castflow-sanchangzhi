/**
 * 音樂本週熱門：Apple Music 台灣「熱門專輯」榜（官方榜單 JSON，免金鑰）。
 * 實測 10/15：榜單已帶專輯名、歌手、發行日、封面（100），不必再 lookup；id 可能超過 integer（works.itunes_id 為 bigint）。
 */

import { albumArtwork, cleanAlbumTitle } from "@/lib/work-picker/itunes-music";
import { ItunesError } from "@/lib/work-picker/itunes";
import type { MusicAlbumResult } from "@/lib/work-picker/types";
import { externalOverridesAllowed } from "@/lib/e2e-overrides";

export const APPLE_MUSIC_TOP_URL = "https://rss.marketingtools.apple.com/api/v2/tw/music/most-played/25/albums.json";
/** 比照 Podcast 榜：Cloud Run 冷抓偶爾慢，放寬到 15 秒；之後都是快取 */
const TIMEOUT_MS = 15_000;

type Raw = Record<string, unknown>;

export interface AppleMusicTopDeps {
  fetch: typeof fetch;
  /** 只給本機 E2E 指到假榜（appleMusicTopUrlFromEnv）；預設官方 */
  topUrl?: string;
}

/** env APPLE_MUSIC_TOP_URL：非 production 才生效 */
export function appleMusicTopUrlFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  if (!externalOverridesAllowed(env)) return undefined;
  return env.APPLE_MUSIC_TOP_URL?.trim() || undefined;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function albumOf(row: Raw): MusicAlbumResult | null {
  const id = typeof row.id === "string" && /^\d+$/.test(row.id) ? Number(row.id) : typeof row.id === "number" ? row.id : Number.NaN;
  const name = text(row.name);
  if (!Number.isSafeInteger(id) || id <= 0 || !name) return null;
  const year = typeof row.releaseDate === "string" ? /^(\d{4})/.exec(row.releaseDate)?.[1] : undefined;
  return {
    kind: "music",
    itunesId: id,
    title: cleanAlbumTitle(name),
    artist: text(row.artistName),
    year: year ? Number(year) : null,
    trackCount: null,
    artworkUrl: albumArtwork(row.artworkUrl100),
    feelingCount: 0,
  };
}

/** 榜單 JSON → 依名次排列的專輯；壞資料跳過 */
export function parseAppleMusicTop(data: unknown): MusicAlbumResult[] {
  const feed = (data as Raw | null)?.feed as Raw | undefined;
  const results = Array.isArray(feed?.results) ? (feed.results as Raw[]) : [];
  return results.flatMap((row) => {
    const album = albumOf(row);
    return album ? [album] : [];
  });
}

export async function loadTrendingAlbums(deps: AppleMusicTopDeps): Promise<MusicAlbumResult[]> {
  let response: Response;
  try {
    response = await deps.fetch(deps.topUrl ?? APPLE_MUSIC_TOP_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new ItunesError(error instanceof Error ? `Apple Music 榜單：${error.message}` : "Apple Music 榜單連線失敗", null);
  }
  if (!response.ok) throw new ItunesError(`Apple Music 榜單回應 ${response.status}`, response.status);
  const albums = parseAppleMusicTop(await response.json());
  if (albums.length === 0) throw new ItunesError("Apple Music 榜單是空的", null);
  return albums;
}
