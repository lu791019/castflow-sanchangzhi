/**
 * 散場之前：音樂本週熱門（Apple Music 台灣熱門專輯，既有 trending 快取）→ 卡片（純函式）。
 * 作品是專輯：主鈕按下去才建作品（iTunes lookup），再開記一筆（在家、選日期時間）。
 */

import type { MusicAlbumResult } from "@/lib/work-picker/types";
import type { BeforeCard } from "./cards";

export const MUSIC_META = "音樂・本週熱門";

/** Apple Music 專輯頁（作品特輯「在哪聽」同一個網址） */
function appleMusicUrl(itunesId: number): string {
  return `https://music.apple.com/tw/album/${itunesId}`;
}

export function musicCards(albums: readonly MusicAlbumResult[], limit: number): BeforeCard[] {
  return albums.slice(0, limit).map((album) => ({
    key: `music:${album.itunesId}`,
    title: album.title,
    posterUrl: album.artworkUrl,
    meta: MUSIC_META,
    placeholder: "music",
    workId: null,
    plan: { type: "music", itunesId: album.itunesId, title: album.title },
    link: { href: appleMusicUrl(album.itunesId), label: "去聽" },
  }));
}
