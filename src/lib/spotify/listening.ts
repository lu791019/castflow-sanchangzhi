/**
 * 收聽紀錄提醒（Q-64 C1）的判斷規則（純函式）：最近播放 → 哪幾張專輯算「聽完」→ 提醒內容與去重鍵。
 * 「聽完一張專輯」：同一張專輯在 windowMs（預設 4 小時）內聽了不同的歌 ≥ 門檻，
 *   門檻＝min(enoughTracks, max(minDistinct, ceil(總曲目 × ratio)))，預設＝過半、至少 3 首、最多要求 8 首（長專輯聽 8 首就算）。
 *   單曲（album_type single）與總曲目 < 4 的不算（EP 以下聽完一首就問太吵）；總曲目不明時要聽滿 enoughTracks。
 *   重複聽同一首只算一首。
 * 去重：同一張專輯同一天（台北）只問一次 → dedupe_key spotify-album:<id>:<YYYY-MM-DD>（notifications unique(user_id, dedupe_key)）。
 * 本機 worker 直接用 node 跑：只用相對路徑 import。
 */

import type { RecentPlay } from "./user-api.ts";

export interface ListenRule {
  windowMs: number;
  ratio: number;
  minDistinct: number;
  enoughTracks: number;
  minAlbumTracks: number;
}

export const DEFAULT_LISTEN_RULE: ListenRule = {
  windowMs: 4 * 60 * 60 * 1000,
  ratio: 0.5,
  minDistinct: 3,
  enoughTracks: 8,
  minAlbumTracks: 4,
};

export interface FinishedAlbum {
  albumId: string;
  name: string;
  artists: string[];
  imageUrl: string | null;
  totalTracks: number | null;
  distinctTracks: number;
  lastPlayedAt: string;
}

/** 這張專輯要聽幾首不同的歌才算聽完；不算專輯（單曲、太短）回 null */
export function tracksNeeded(albumType: string, totalTracks: number | null, rule: ListenRule = DEFAULT_LISTEN_RULE): number | null {
  if (albumType === "single") return null;
  if (totalTracks === null) return rule.enoughTracks;
  if (totalTracks < rule.minAlbumTracks) return null;
  return Math.min(rule.enoughTracks, Math.max(rule.minDistinct, Math.ceil(totalTracks * rule.ratio)));
}

/** 最近播放（任意順序）→ 聽完的專輯，最近聽完的在前 */
export function finishedAlbums(plays: readonly RecentPlay[], now: Date, rule: ListenRule = DEFAULT_LISTEN_RULE): FinishedAlbum[] {
  const since = now.getTime() - rule.windowMs;
  const recent = plays.filter((play) => {
    const at = Date.parse(play.playedAt);
    return at >= since && at <= now.getTime();
  });
  const byAlbum = new Map<string, RecentPlay[]>();
  for (const play of recent) byAlbum.set(play.album.id, [...(byAlbum.get(play.album.id) ?? []), play]);

  return [...byAlbum.values()]
    .flatMap((albumPlays): FinishedAlbum[] => {
      const [first] = albumPlays;
      const needed = tracksNeeded(first.album.albumType, first.album.totalTracks, rule);
      const distinct = new Set(albumPlays.map((play) => play.trackId)).size;
      if (needed === null || distinct < needed) return [];
      const lastPlayedAt = albumPlays.map((play) => play.playedAt).reduce((latest, at) => (Date.parse(at) > Date.parse(latest) ? at : latest));
      return [
        {
          albumId: first.album.id,
          name: first.album.name,
          artists: first.album.artists,
          imageUrl: first.album.imageUrl,
          totalTracks: first.album.totalTracks,
          distinctTracks: distinct,
          lastPlayedAt,
        },
      ];
    })
    .sort((a, b) => Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt));
}

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 台北日期 YYYY-MM-DD（台灣沒有日光節約） */
export function taipeiDay(date: Date): string {
  return new Date(date.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

export function listenDedupeKey(albumId: string, now: Date): string {
  return `spotify-album:${albumId}:${taipeiDay(now)}`;
}

/** 點提醒 → 記一筆並預選這張專輯（/journal/new 依 Spotify 專輯 id 找或建作品） */
export function listenPromptUrl(albumId: string): string {
  return `/journal/new?spotifyAlbum=${encodeURIComponent(albumId)}`;
}

export interface ListenPrompt {
  title: string;
  body: string;
  url: string;
  dedupeKey: string;
}

export function listenPrompt(album: FinishedAlbum, now: Date): ListenPrompt {
  const by = album.artists.length > 0 ? `${album.artists.join("、")}・` : "";
  return {
    title: `要不要記一筆《${album.name}》？`,
    body: `${by}剛剛聽了 ${album.distinctTracks} 首`,
    url: listenPromptUrl(album.albumId),
    dedupeKey: listenDedupeKey(album.albumId, now),
  };
}
