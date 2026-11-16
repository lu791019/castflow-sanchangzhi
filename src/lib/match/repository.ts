/**
 * 同好配對的資料（server only，service role）。
 * 候選人只限「至少一篇以筆名署名＋公開發佈文章」的人（沿用 P3 規則，public-authors），最多掃 CANDIDATE_LIMIT 人。
 * 候選人那一側只讀公開筆名文章（作品、發佈週）與畫在公開文章上的畫記，不讀候選人的日誌（見 candidates.ts）。
 * 看的人自己那一側用自己的日誌（自己的資料）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { loadProfilePenNames, PUBLIC_PEN_NAME_FILTER } from "@/lib/resonance/public-authors";
import type { SimilarAuthor } from "@/lib/embeddings/repository";
import { buildCandidates, mergeAuthorIds, type CandidateArticle, type CandidateMark, type CandidateSimilarity } from "./candidates";
import { showWeekKey, SIMILARITY_THRESHOLD, type MatchCandidate } from "./score";

export const CANDIDATE_LIMIT = 200;
const AUTHOR_SCAN_LIMIT = 2000;
const ROW_LIMIT = 20_000;
const TITLE_LIMIT = 100;

interface JournalRow {
  user_id: string;
  work_id: string;
  experienced_at: string;
}

/** 最近有公開筆名文章的人（新到舊），排除自己 */
async function listPublicAuthorIds(excludeUserId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("user_id")
    .eq("visibility", PUBLIC_PEN_NAME_FILTER.visibility)
    .eq("byline", PUBLIC_PEN_NAME_FILTER.byline)
    .not("published_at", "is", null)
    .not("share_slug", "is", null)
    .neq("source", "rss")
    .neq("user_id", excludeUserId)
    .order("published_at", { ascending: false })
    .limit(AUTHOR_SCAN_LIMIT);
  if (error) throw new Error(`讀取公開作者失敗：${error.message}`);
  return [...new Set((data ?? []).map((row) => row.user_id as string))].slice(0, CANDIDATE_LIMIT);
}

/** 只讀看的人自己的日誌；候選人的日誌一律不讀 */
async function loadOwnJournalRows(userId: string): Promise<JournalRow[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("user_id, work_id, experienced_at")
    .eq("user_id", userId)
    .not("work_id", "is", null)
    .neq("status", "skipped")
    .limit(ROW_LIMIT);
  if (error) throw new Error(`讀取日誌失敗：${error.message}`);
  return (data ?? []) as JournalRow[];
}

/** 候選人以筆名署名＋公開發佈的文章（帶上過濾欄位，純函式再驗一次） */
async function loadPublicArticles(userIds: readonly string[]): Promise<CandidateArticle[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, user_id, work_id, published_at, visibility, byline")
    .in("user_id", [...userIds])
    .eq("visibility", PUBLIC_PEN_NAME_FILTER.visibility)
    .eq("byline", PUBLIC_PEN_NAME_FILTER.byline)
    .not("published_at", "is", null)
    .not("work_id", "is", null)
    .neq("source", "rss")
    .limit(ROW_LIMIT);
  if (error) throw new Error(`讀取公開文章失敗：${error.message}`);
  return (data ?? []) as CandidateArticle[];
}

/** 我畫過的文章裡，哪些是以筆名署名＋公開發佈的（畫記句只比對這些） */
async function loadPublicEpisodeIds(episodeIds: readonly string[]): Promise<Set<string>> {
  if (episodeIds.length === 0) return new Set();
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id")
    .in("id", [...episodeIds])
    .eq("visibility", PUBLIC_PEN_NAME_FILTER.visibility)
    .eq("byline", PUBLIC_PEN_NAME_FILTER.byline)
    .not("published_at", "is", null)
    .neq("source", "rss");
  if (error) throw new Error(`讀取畫記文章失敗：${error.message}`);
  return new Set((data ?? []).map((row) => row.id as string));
}

/** 候選人在「我畫過、且公開的那些文章」上的畫記 */
async function loadMarkRows(userIds: readonly string[], episodeIds: readonly string[]): Promise<CandidateMark[]> {
  if (episodeIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("passage_resonances")
    .select("user_id, episode_id, passage_hash")
    .in("user_id", [...userIds])
    .in("episode_id", [...episodeIds])
    .limit(ROW_LIMIT);
  if (error) throw new Error(`讀取畫記失敗：${error.message}`);
  return (data ?? []) as CandidateMark[];
}

/** 我自己的同週同場鍵（只讀本人日誌裡有作品的紀錄） */
export async function loadSelfShowWeeks(userId: string): Promise<string[]> {
  const rows = await loadOwnJournalRows(userId);
  return rows.map((row) => showWeekKey(row.work_id, new Date(row.experienced_at)));
}

/**
 * similar：向量相似的作者（DB 端只用雙方公開筆名文章算）。夠像（≥ 門檻）的人即使不在最近作者名單裡也加進候選。
 */
export async function loadMatchCandidates(
  userId: string,
  myPassages: readonly string[],
  similar: readonly SimilarAuthor[] = [],
): Promise<MatchCandidate[]> {
  const alike = similar.filter((author) => author.similarity >= SIMILARITY_THRESHOLD).map((author) => author.userId);
  const authorIds = mergeAuthorIds(await listPublicAuthorIds(userId), alike, userId);
  if (authorIds.length === 0) return [];
  const publicEpisodes = await loadPublicEpisodeIds([...new Set(myPassages.map((key) => key.split(":")[0]))]);
  const [penNames, articles, marks] = await Promise.all([
    loadProfilePenNames(authorIds),
    loadPublicArticles(authorIds),
    loadMarkRows(authorIds, [...publicEpisodes]),
  ]);
  const similarity = new Map<string, CandidateSimilarity>(
    similar.map((author) => [author.userId, { similarity: author.similarity, title: author.title }]),
  );
  return buildCandidates(authorIds, penNames, articles, marks, publicEpisodes, similarity);
}

export async function loadWorkTitles(workIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(workIds)].slice(0, TITLE_LIMIT);
  if (ids.length === 0) return new Map();
  const { data, error } = await createAdminClient().from("works").select("id, title").in("id", ids);
  if (error) throw new Error(`讀取作品名失敗：${error.message}`);
  return new Map(((data ?? []) as Array<{ id: string; title: string }>).map((row) => [row.id, row.title]));
}
