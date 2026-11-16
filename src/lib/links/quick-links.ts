/** 不碰 TMDB 模組的在哪看小工具（client 可用）：curated 直連、TMDB 觀看頁、本週熱門每列次鈕 */

import { curatedFor } from "./curated";
import { buildSearchLinks } from "./search-links";
import type { WorkLink } from "./types";

export function curatedWatchLinks(kind: "movie" | "series", tmdbId: number): WorkLink[] {
  return curatedFor(kind, tmdbId).map((link) => ({ kind: "watch", ...link, origin: "curated", note: null }));
}

export function tmdbWatchPage(kind: "movie" | "series", tmdbId: number): string {
  return `https://www.themoviedb.org/${kind === "movie" ? "movie" : "tv"}/${tmdbId}/watch?locale=TW`;
}

export interface QuickWatchInput {
  kind: "movie" | "series";
  tmdbId: number;
  title: string;
  /** 本週熱門的區段鍵：now_playing（正在上映）／upcoming／trending */
  section: string;
}

/** 本週熱門每列的次鈕（只有 tmdbId，不打 DB）：上映中 → 訂票；有 curated → 平台直連；否則 TMDB 觀看頁 */
export function quickWatchLink({ kind, tmdbId, title, section }: QuickWatchInput): WorkLink {
  if (kind === "movie" && section === "now_playing") {
    const showtimes = buildSearchLinks({ kind, venueType: null, title, inTheaters: true }).find((link) => link.kind === "ticket");
    if (showtimes) return { ...showtimes, label: "訂票" };
  }
  const curated = curatedWatchLinks(kind, tmdbId)[0];
  if (curated) return curated;
  return { kind: "watch", source: "tmdb", label: "在哪看", url: tmdbWatchPage(kind, tmdbId), origin: "tmdb", note: null };
}
