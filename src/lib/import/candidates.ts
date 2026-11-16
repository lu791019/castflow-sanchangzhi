/**
 * 作品候選（純函式）：LLM 判斷出的作品名丟既有的 /api/works/search（TMDB），
 * 結果依年份接近程度排序取前 3。只是排序，最後由使用者在畫面上選定（10/13「師父」配錯年份的教訓）。
 */

import type { ScreenResult } from "@/lib/work-picker/types";
import type { WorkGuess } from "./guess";

export const CANDIDATE_LIMIT = 3;

function yearBucket(year: number | null, target: number | null): number {
  if (target === null || year === null) return 2;
  const gap = Math.abs(year - target);
  return gap === 0 ? 0 : gap === 1 ? 1 : 2;
}

export function rankCandidates(results: readonly ScreenResult[], guess: Pick<WorkGuess, "year">): ScreenResult[] {
  return results
    .map((item, index) => ({ item, index, bucket: yearBucket(item.year, guess.year) }))
    .sort((a, b) => a.bucket - b.bucket || a.index - b.index)
    .slice(0, CANDIDATE_LIMIT)
    .map(({ item }) => item);
}

/** 電影／影集才自動搜尋；Podcast 要選到單集、演出展覽走場外，都交給使用者 */
export function candidateQuery(guess: WorkGuess): { kind: "movie" | "series"; query: string } | null {
  if (guess.kind !== "movie" && guess.kind !== "series") return null;
  const query = guess.title ?? guess.originalTitle;
  return query ? { kind: guess.kind, query } : null;
}
