/**
 * 詞向量的資料（server only，service role）。
 * 只有公開筆名文章會被讀成文字送出；不符合的只回 eligible:false 讓呼叫端刪列。
 * 配對用的 similar_public_authors() 在 DB 端再過濾一次公開筆名規則。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isEmbeddable, type EmbeddableFields } from "./eligibility";
import type { EmbeddingRow, EmbeddingSource, EmbeddingStore } from "./sync";
import { buildEmbeddingText } from "./text";

interface EpisodeRow extends EmbeddableFields {
  id: string;
  title: string | null;
  work_id: string | null;
}

interface TextRow {
  id: string;
  title: string | null;
  work_id: string | null;
}

export interface SimilarAuthor {
  userId: string;
  similarity: number;
  episodeId: string;
  title: string;
}

async function loadTexts(rows: readonly TextRow[]): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const supabase = createAdminClient();
  const workIds = [...new Set(rows.flatMap((row) => (row.work_id ? [row.work_id] : [])))];
  const [contents, works] = await Promise.all([
    supabase.from("contents").select("episode_id, body").in("episode_id", rows.map((row) => row.id)).eq("platform", "blog"),
    workIds.length > 0 ? supabase.from("works").select("id, title").in("id", workIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (contents.error) throw new Error(`讀取正文失敗：${contents.error.message}`);
  if (works.error) throw new Error(`讀取作品名失敗：${works.error.message}`);
  const bodies = new Map(((contents.data ?? []) as Array<{ episode_id: string; body: string | null }>).map((row) => [row.episode_id, row.body]));
  const titles = new Map(((works.data ?? []) as Array<{ id: string; title: string }>).map((row) => [row.id, row.title]));
  return new Map(
    rows.map((row) => [
      row.id,
      buildEmbeddingText({
        title: row.title ?? "",
        workTitle: row.work_id ? (titles.get(row.work_id) ?? null) : null,
        body: bodies.get(row.id) ?? null,
      }),
    ]),
  );
}

async function loadStoredHash(episodeId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("episode_embeddings")
    .select("content_hash")
    .eq("episode_id", episodeId)
    .maybeSingle();
  if (error) throw new Error(`讀取詞向量失敗：${error.message}`);
  return (data?.content_hash as string | undefined) ?? null;
}

async function loadSource(episodeId: string): Promise<EmbeddingSource | null> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, title, work_id, visibility, byline, published_at, share_slug, source")
    .eq("id", episodeId)
    .maybeSingle();
  if (error) throw new Error(`讀取文章失敗：${error.message}`);
  if (!data) return null;
  const episode = data as EpisodeRow;
  const storedHash = await loadStoredHash(episodeId);
  if (!isEmbeddable(episode)) return { episodeId, eligible: false, text: "", storedHash };
  const texts = await loadTexts([episode]);
  return { episodeId, eligible: true, text: texts.get(episodeId) ?? "", storedHash };
}

async function loadQueue(limit: number): Promise<EmbeddingSource[]> {
  const { data, error } = await createAdminClient().rpc("embedding_refresh_queue", { p_limit: limit });
  if (error) throw new Error(`讀取補算佇列失敗：${error.message}`);
  const rows = (data ?? []) as Array<{ episode_id: string; title: string | null; work_id: string | null; content_hash: string | null }>;
  const texts = await loadTexts(rows.map((row) => ({ id: row.episode_id, title: row.title, work_id: row.work_id })));
  return rows.map((row) => ({
    episodeId: row.episode_id,
    eligible: true,
    text: texts.get(row.episode_id) ?? "",
    storedHash: row.content_hash,
  }));
}

async function upsert(row: EmbeddingRow): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("episode_embeddings")
    .upsert({
      episode_id: row.episodeId,
      model: row.model,
      dim: row.embedding.length,
      embedding: `[${row.embedding.join(",")}]`,
      content_hash: row.contentHash,
      created_at: now,
      checked_at: now,
    });
  if (error) throw new Error(`寫入詞向量失敗：${error.message}`);
}

async function remove(episodeId: string): Promise<void> {
  const { error } = await createAdminClient().from("episode_embeddings").delete().eq("episode_id", episodeId);
  if (error) throw new Error(`刪除詞向量失敗：${error.message}`);
}

async function markChecked(episodeIds: readonly string[]): Promise<void> {
  const { error } = await createAdminClient()
    .from("episode_embeddings")
    .update({ checked_at: new Date().toISOString() })
    .in("episode_id", [...episodeIds]);
  if (error) throw new Error(`更新核對時間失敗：${error.message}`);
}

export function createSupabaseEmbeddingStore(): EmbeddingStore {
  return { loadSource, loadQueue, upsert, remove, markChecked };
}

/** 每位其他公開筆名作者與我最像的那一篇（只看我自己的公開筆名文章；我沒有 embedding 就回空） */
export async function loadSimilarAuthors(userId: string, minSimilarity: number): Promise<SimilarAuthor[]> {
  const { data, error } = await createAdminClient().rpc("similar_public_authors", {
    p_user_id: userId,
    p_min_similarity: minSimilarity,
  });
  if (error) throw new Error(`讀取相似作者失敗：${error.message}`);
  return ((data ?? []) as Array<{ user_id: string; similarity: number; episode_id: string; title: string | null }>).map((row) => ({
    userId: row.user_id,
    similarity: Number(row.similarity),
    episodeId: row.episode_id,
    title: row.title ?? "",
  }));
}
