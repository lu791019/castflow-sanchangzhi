/**
 * 收聽提醒點進來（/journal/new?spotifyAlbum=<id>，Q-64 C1）：Spotify 專輯 → 散場誌的音樂作品，給記一筆預選。
 * 1. 已有作品的 Spotify 直連就是這張（A② 自動配的或讀者貼的）→ 直接用
 * 2. 否則讀 Spotify 專輯（名稱、藝人、曲目數）→ iTunes 搜「專輯 藝人」→ 用同一套保守比對（match.ts）找同一張
 *    → 建作品（同 itunes_id 已有就取回）並補上這張的 Spotify 直連
 * 3. 都沒把握 → null（記一筆照常打開，讓讀者自己挑；不亂建作品）
 * 依賴注入，純流程可測；接線在 listen-work-repository.ts。
 */

import type { MusicAlbumResult, PickerWork } from "@/lib/work-picker/types";
import type { SpotifyAlbumDetail } from "./api.ts";
import { matchAlbum, type SpotifyAlbumCandidate } from "./match.ts";

const ALBUM_ID = /^[A-Za-z0-9]{22}$/;

export function isSpotifyAlbumId(value: unknown): value is string {
  return typeof value === "string" && ALBUM_ID.test(value);
}

export function spotifyAlbumUrl(albumId: string): string {
  return `https://open.spotify.com/album/${albumId}`;
}

export interface ListenWorkDeps {
  findLinkedWork: (albumUrl: string) => Promise<PickerWork | null>;
  getAlbum: (albumId: string) => Promise<SpotifyAlbumDetail | null>;
  searchItunes: (term: string) => Promise<MusicAlbumResult[]>;
  createMusicWork: (itunesId: number) => Promise<PickerWork>;
  /** insert-if-absent（讀者貼的優先） */
  saveAutoLink: (workId: string, url: string) => Promise<boolean>;
  warn: (title: string, detail: string) => void;
}

/** iTunes 搜尋結果轉成比對用的形狀（反過來拿 Spotify 專輯當「作品」比） */
function itunesCandidate(album: MusicAlbumResult): SpotifyAlbumCandidate {
  return {
    id: String(album.itunesId),
    name: album.title,
    album_type: album.trackCount !== null && album.trackCount <= 3 ? "single" : "album",
    total_tracks: album.trackCount,
    artists: album.artist ? [album.artist] : [],
  };
}

export function matchItunesAlbum(spotify: SpotifyAlbumDetail, results: readonly MusicAlbumResult[]): MusicAlbumResult | null {
  const hit = matchAlbum(
    { title: spotify.name, credit: spotify.artists.join(" & "), trackCount: spotify.total_tracks },
    results.map(itunesCandidate),
  );
  return hit ? (results.find((album) => String(album.itunesId) === hit.id) ?? null) : null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 找或建；任何失敗都回 null 並警報（記一筆照常打開，不擋路） */
export async function resolveListenWork(albumId: string, deps: ListenWorkDeps): Promise<PickerWork | null> {
  if (!isSpotifyAlbumId(albumId)) return null;
  const url = spotifyAlbumUrl(albumId);
  try {
    const linked = await deps.findLinkedWork(url);
    if (linked) return linked;
    const album = await deps.getAlbum(albumId);
    if (!album || album.artists.length === 0) return null;
    const hit = matchItunesAlbum(album, await deps.searchItunes(`${album.name} ${album.artists[0]}`));
    if (!hit) return null;
    const work = await deps.createMusicWork(hit.itunesId);
    await deps.saveAutoLink(work.id, url);
    return work;
  } catch (error) {
    deps.warn("收聽提醒：找不到或建不了這張專輯的作品（記一筆照常打開）", `album=${albumId}：${message(error)}`);
    return null;
  }
}
