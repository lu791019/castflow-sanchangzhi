/**
 * 同好配對（Q-40 A，純函式）：
 * 重疊度＝Jaccard(作品集合)×1 ＋ 共同畫記句×2 ＋ 同週同場×1 ＋ 向量相似分×1（Q-48）。
 * 配到的條件：至少一部共同作品，或文章向量相似 ≥ SIMILARITY_THRESHOLD；取前 MATCH_LIMIT 人。
 * 向量相似＝我與對方「公開筆名文章」之間最像的一對的 cosine；自己沒有 embedding 時候選都不帶 similarity，等同只看共同作品。
 */

import { taipeiDateKey } from "@/lib/journal/time";
import { thisWeekStart } from "@/lib/resonance/week";

export const MATCH_LIMIT = 3;
/** 沒有共同作品時，cosine 至少要這麼像才算配到（可調） */
export const SIMILARITY_THRESHOLD = 0.75;
/** cosine 低於這個值相似分算 0；FLOOR→1 線性映射到 0→1（可調） */
export const SIMILARITY_FLOOR = 0.5;
const WEIGHTS = { works: 1, passages: 2, sameWeek: 1, similarity: 1 } as const;

export interface MatchSelf {
  works: readonly string[];
  /** `episodeId:passageHash` */
  passages: readonly string[];
  /** `workId@週一日期`：同一部、同一週 */
  showWeeks: readonly string[];
}

export interface MatchCandidate extends MatchSelf {
  userId: string;
  penName: string;
  /** 與我最像的那對文章的 cosine；沒有 embedding（任一方）時不帶 */
  similarity?: number;
  /** 對方那篇最像的文章標題 */
  similarTitle?: string;
}

export interface Overlap {
  score: number;
  commonWorks: string[];
  sharedPassages: number;
  sameWeekShows: number;
  /** 原始 cosine；沒有時 0 */
  similarity: number;
  similarTitle: string | null;
}

export interface Match extends Overlap {
  userId: string;
  penName: string;
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]).size;
  if (union === 0) return 0;
  return [...left].filter((item) => right.has(item)).length / union;
}

function intersect(a: readonly string[], b: readonly string[]): string[] {
  const right = new Set(b);
  return [...new Set(a)].filter((item) => right.has(item));
}

/** 台北週一的日期（YYYY-MM-DD） */
export function weekKey(date: Date): string {
  return taipeiDateKey(thisWeekStart(date));
}

export function showWeekKey(workId: string, experiencedAt: Date): string {
  return `${workId}@${weekKey(experiencedAt)}`;
}

/** cosine → 0–1：SIMILARITY_FLOOR 以下 0，1 為 1，中間線性 */
export function similarityScore(cosine: number | undefined): number {
  if (cosine === undefined || !Number.isFinite(cosine)) return 0;
  return Math.min(1, Math.max(0, (cosine - SIMILARITY_FLOOR) / (1 - SIMILARITY_FLOOR)));
}

export function overlapScore(self: MatchSelf, other: MatchSelf & Pick<MatchCandidate, "similarity" | "similarTitle">): Overlap {
  const commonWorks = intersect(self.works, other.works);
  const sharedPassages = intersect(self.passages, other.passages).length;
  const sameWeekShows = intersect(self.showWeeks, other.showWeeks).length;
  const score =
    jaccard(self.works, other.works) * WEIGHTS.works +
    sharedPassages * WEIGHTS.passages +
    sameWeekShows * WEIGHTS.sameWeek +
    similarityScore(other.similarity) * WEIGHTS.similarity;
  return {
    score,
    commonWorks,
    sharedPassages,
    sameWeekShows,
    similarity: other.similarity ?? 0,
    similarTitle: other.similarTitle ?? null,
  };
}

function isMatched(overlap: Overlap): boolean {
  return overlap.commonWorks.length > 0 || overlap.similarity >= SIMILARITY_THRESHOLD;
}

export function pickMatches(
  self: MatchSelf,
  candidates: readonly MatchCandidate[],
  options: { excludeUserId?: string; limit?: number } = {},
): Match[] {
  return candidates
    .filter((candidate) => candidate.userId !== options.excludeUserId)
    .map((candidate) => ({ userId: candidate.userId, penName: candidate.penName, ...overlapScore(self, candidate) }))
    .filter(isMatched)
    .sort(
      (a, b) =>
        b.score - a.score || b.commonWorks.length - a.commonWorks.length || a.penName.localeCompare(b.penName, "zh-Hant"),
    )
    .slice(0, options.limit ?? MATCH_LIMIT);
}
