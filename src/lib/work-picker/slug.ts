/** works.slug 生成：必須符合 format.ts 的 WORK_SLUG_PATTERN（ascii 小寫、≤64 字） */

import type { WorkKind } from "@/lib/works/format";

/** FNV-1a 32-bit → 8 碼 hex；UTF-8 位元組逐一混入，非 ASCII 也穩定 */
export function fnv1a(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** 電影／影集：movie-331482（同一 tmdb 作品永遠同一 slug，配合去重） */
export function tmdbSlug(kind: "movie" | "series", tmdbId: number): string {
  return `${kind}-${tmdbId}`;
}

/** Podcast 單集：pod-<feed 雜湊>-<guid 雜湊>（guid 常是 URL，不能直接入 slug） */
export function podcastSlug(feedUrl: string, guid: string): string {
  return `pod-${fnv1a(feedUrl)}-${fnv1a(guid)}`;
}

/** 音樂專輯：music-<iTunes collectionId>（同一張專輯永遠同一 slug，配合去重） */
export function musicSlug(itunesId: number): string {
  return `music-${itunesId}`;
}

/** 手動輸入：manual-<kind>-<標題雜湊>-<nonce base36>；同名可重複建，靠 nonce 區分 */
export function manualSlug(kind: WorkKind, title: string, nonce: number): string {
  const kindPart = kind.replaceAll("_", "-");
  return `manual-${kindPart}-${fnv1a(title)}-${Math.max(0, Math.floor(nonce)).toString(36)}`;
}
