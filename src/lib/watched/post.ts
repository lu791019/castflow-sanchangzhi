/**
 * 「看完了」產出的 Threads 貼文組裝（純函式）：星等與作品頁連結由程式加，不交給模型（Q-72、Q-73）。
 * 字數照 Threads 算法（所有字元），上限 500。
 */

import { WATCHED_THREADS_MAX_CHARS } from "@castflow/engine/generate/watched-prompt";

/** 存在 contents.platform；與校樣的 6 平台分開，校樣重整不會刪到 */
export const WATCHED_POST_PLATFORM = "threads_post";
export const WATCHED_LONGFORM_PLATFORM = "longform";

export function formatStars(rating: number): string {
  const full = Math.floor(rating);
  return "★".repeat(full) + (rating - full >= 0.5 ? "½" : "");
}

/** 點第 n 顆＝n 顆；再點同一顆＝n−0.5（半顆）；半顆再點回 n */
export function nextRating(current: number | null, tapped: number): number {
  return current === tapped ? tapped - 0.5 : tapped;
}

export function workPageUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/works/${encodeURIComponent(slug)}`;
}

export interface ComposePostInput {
  body: string;
  rating: number | null;
  includeRating: boolean;
  /** 作品頁網址；沒綁作品就不附 */
  link: string | null;
}

/** 本文 → （星等）→ （連結），段落間空一行 */
export function composePost({ body, rating, includeRating, link }: ComposePostInput): string {
  const parts = [body.trim()];
  if (includeRating && rating !== null) parts.push(formatStars(rating));
  if (link) parts.push(link);
  return parts.filter(Boolean).join("\n\n");
}

export function postLength(text: string): number {
  return Array.from(text).length;
}

export function isPostTooLong(text: string): boolean {
  return postLength(text) > WATCHED_THREADS_MAX_CHARS;
}

export { WATCHED_THREADS_MAX_CHARS };
