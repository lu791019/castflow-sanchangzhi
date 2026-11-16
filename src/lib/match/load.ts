/**
 * 散場之前「有人跟你看了同樣 N 部」（server only）：每次請求現算（使用者少），取前 3 人。
 * 讀不到就回空並推 warn（降級不可靜默）；沒有配到就不顯示。
 * 向量相似（Q-48）讀不到時推 warn、退回只用共同作品，不讓整塊消失。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { communityEnabled } from "@/lib/features";
import { loadSimilarAuthors, type SimilarAuthor } from "@/lib/embeddings/repository";
import { loadTasteProfile } from "@/lib/taste/load";
import { loadMatchCandidates, loadSelfShowWeeks, loadWorkTitles } from "./repository";
import { SHOWN_TITLES } from "./constants";
import { pickMatches, SIMILARITY_FLOOR, SIMILARITY_THRESHOLD } from "./score";

export interface TasteMatch {
  userId: string;
  penName: string;
  commonCount: number;
  titles: string[];
  /** 寫的東西夠像（≥ 門檻）時：對方最像的那篇標題；否則 null */
  similarTitle: string | null;
}

async function loadSimilarSafely(userId: string): Promise<SimilarAuthor[]> {
  try {
    return await loadSimilarAuthors(userId, SIMILARITY_FLOOR);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[match] 向量相似讀取失敗，先只用共同作品", { detail });
    void getServerNotify()("warn", "同好配對：向量相似讀不到，退回只用共同作品", detail).catch(() => undefined);
    return [];
  }
}

async function computeMatches(userId: string): Promise<TasteMatch[]> {
  const [profile, showWeeks, similar] = await Promise.all([
    loadTasteProfile(userId),
    loadSelfShowWeeks(userId),
    loadSimilarSafely(userId),
  ]);
  if (profile.works.length === 0 && similar.length === 0) return [];
  const candidates = await loadMatchCandidates(userId, profile.passages, similar);
  const matches = pickMatches({ works: profile.works, passages: profile.passages, showWeeks }, candidates, { excludeUserId: userId });
  const titles = await loadWorkTitles(matches.flatMap((match) => match.commonWorks.slice(0, SHOWN_TITLES)));
  return matches.map((match) => ({
    userId: match.userId,
    penName: match.penName,
    commonCount: match.commonWorks.length,
    titles: match.commonWorks.slice(0, SHOWN_TITLES).flatMap((id) => {
      const title = titles.get(id);
      return title ? [title] : [];
    }),
    similarTitle: match.similarity >= SIMILARITY_THRESHOLD ? (match.similarTitle ?? "") : null,
  }));
}

export async function loadTasteMatches(userId: string): Promise<TasteMatch[]> {
  // 會露出別人的筆名與印章，跟著社群開關走
  if (!communityEnabled()) return [];
  try {
    return await computeMatches(userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[match] 同好配對讀取失敗，先不顯示", { detail });
    void getServerNotify()("warn", "散場之前：同好配對讀不到", detail).catch(() => undefined);
    return [];
  }
}
