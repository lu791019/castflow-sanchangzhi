/**
 * 音樂「在哪聽」（Q-61）：搜尋連結法，不打任何要金鑰的 API。
 * 有 iTunes collectionId 時 Apple Music 直連專輯頁，其餘帶「專輯名 歌手」跳各站搜尋頁。
 *
 * 2026-10-15 實測（curl＋瀏覽器 UA，關鍵字「告五人 帶你飛」）：
 * - Apple Music   https://music.apple.com/tw/album/<id>、/tw/search?term=<q> → 200
 * - Spotify       https://open.spotify.com/search/<q>                       → 200（路徑式）
 * - KKBOX         https://www.kkbox.com/tw/tc/search?q=<q>                  → 200，結果頁含關鍵字（`?word=` 不帶入）
 * - YouTube Music https://music.youtube.com/search?q=<q>                    → 200
 */

import type { PlatformRow, WatchInfo } from "@/lib/watch/service";

const enc = encodeURIComponent;
const SEARCH_NOTE = "搜尋";

export interface MusicLinkWork {
  title: string;
  credit: string | null;
  itunes_id: number | null;
}

export function musicQuery(work: Pick<MusicLinkWork, "title" | "credit">): string {
  return [work.title, work.credit].map((part) => part?.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
}

function appleMusicRow(work: MusicLinkWork, query: string): PlatformRow {
  return work.itunes_id
    ? { name: "Apple Music", note: "專輯頁", url: `https://music.apple.com/tw/album/${work.itunes_id}` }
    : { name: "Apple Music", note: SEARCH_NOTE, url: `https://music.apple.com/tw/search?term=${enc(query)}` };
}

export function musicListenInfo(work: MusicLinkWork): WatchInfo {
  const query = musicQuery(work);
  if (!work.title.trim()) return { status: "none", platforms: [], attribution: null };
  return {
    status: "available",
    attribution: null,
    platforms: [
      appleMusicRow(work, query),
      { name: "Spotify", note: SEARCH_NOTE, url: `https://open.spotify.com/search/${enc(query)}` },
      { name: "KKBOX", note: SEARCH_NOTE, url: `https://www.kkbox.com/tw/tc/search?q=${enc(query)}` },
      { name: "YouTube Music", note: SEARCH_NOTE, url: `https://music.youtube.com/search?q=${enc(query)}` },
    ],
  };
}
