/**
 * 同好配對的候選人（純函式）：候選人那一側只用「以筆名署名＋公開發佈」的文章——
 * 作品＝公開文章綁的作品、同週同場＝公開文章的作品＋發佈那週、畫記句＝畫在公開筆名文章上的。
 * 不讀候選人的日誌（recorded、planned 都不行），卡上露出的共同作品名在對方那邊一定公開過。
 * 向量相似（Q-48）由 DB 端只用雙方公開筆名文章算好，這裡只併進候選人。
 */

import { PUBLIC_PEN_NAME_FILTER } from "@/lib/resonance/public-authors";
import { showWeekKey, type MatchCandidate } from "./score";

export interface CandidateArticle {
  id: string;
  user_id: string;
  work_id: string | null;
  published_at: string | null;
  visibility: string;
  byline: string;
}

export interface CandidateMark {
  user_id: string;
  episode_id: string;
  passage_hash: string;
}

function isPublicPenName(article: CandidateArticle): article is CandidateArticle & { work_id: string; published_at: string } {
  return (
    article.visibility === PUBLIC_PEN_NAME_FILTER.visibility &&
    article.byline === PUBLIC_PEN_NAME_FILTER.byline &&
    article.published_at !== null &&
    article.work_id !== null
  );
}

export interface CandidateSimilarity {
  similarity: number;
  /** 對方那篇最像的文章標題 */
  title: string;
}

/** 共同作品的掃描名單＋向量相似的作者，去重、排除自己 */
export function mergeAuthorIds(scanned: readonly string[], similar: readonly string[], excludeUserId: string): string[] {
  return [...new Set([...scanned, ...similar])].filter((id) => id !== excludeUserId);
}

export function buildCandidates(
  authorIds: readonly string[],
  penNames: ReadonlyMap<string, string>,
  articles: readonly CandidateArticle[],
  marks: readonly CandidateMark[],
  publicMarkedEpisodes: ReadonlySet<string> = new Set(),
  similar: ReadonlyMap<string, CandidateSimilarity> = new Map(),
): MatchCandidate[] {
  const open = articles.filter(isPublicPenName);
  return authorIds.flatMap((userId) => {
    const penName = penNames.get(userId);
    if (!penName) return [];
    const own = open.filter((article) => article.user_id === userId);
    const alike = similar.get(userId);
    return [
      {
        userId,
        penName,
        works: [...new Set(own.map((article) => article.work_id))],
        showWeeks: [...new Set(own.map((article) => showWeekKey(article.work_id, new Date(article.published_at))))],
        passages: marks
          .filter((mark) => mark.user_id === userId && publicMarkedEpisodes.has(mark.episode_id))
          .map((mark) => `${mark.episode_id}:${mark.passage_hash}`),
        ...(alike ? { similarity: alike.similarity, similarTitle: alike.title } : {}),
      },
    ];
  });
}
