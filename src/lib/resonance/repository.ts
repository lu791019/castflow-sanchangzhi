/**
 * 文章頁共鳴記號的讀寫（server only，service role；寫入一律帶登入者 userId）。
 * 只有分享頁看得到的文章（公開或只給有連結的人、有正文）能留記號；
 * 段必須存在於現行正文（雜湊比對），對不上的不收、不顯示。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { deriveLede, parseArticle } from "@/lib/share/article";
import { isShareable, parseVisibility } from "@/lib/proof/publish";
import type { PassageMark } from "./marks";
import { listPassages, type Passage } from "./passage";

const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MAX_MARK_ROWS = 5000;
const PG_UNIQUE_VIOLATION = "23505";

export interface SharedArticle {
  episodeId: string;
  passages: Passage[];
}

/** 依分享網址讀文章的段（與分享頁同一套可見規則）；看不到回 null */
export async function loadSharedArticle(slug: string): Promise<SharedArticle | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const supabase = createAdminClient();
  const { data: episode, error } = await supabase
    .from("episodes")
    .select("id, visibility")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error || !episode) return null;
  if (!isShareable(parseVisibility(episode.visibility) ?? "public")) return null;
  const { data: content, error: contentError } = await supabase
    .from("contents")
    .select("body")
    .eq("episode_id", episode.id)
    .eq("platform", "blog")
    .limit(1)
    .maybeSingle();
  if (contentError || !content?.body) return null;
  const { blocks } = deriveLede(parseArticle(content.body).blocks);
  return { episodeId: episode.id as string, passages: listPassages(blocks) };
}

/** 文章每段的記號：hash → {總人數, 你有沒有標}；只算現行正文對得上的段 */
export async function loadPassageMarks(
  episodeId: string,
  passages: readonly Passage[],
  viewerId: string | null,
): Promise<Record<string, PassageMark>> {
  const hashes = [...new Set(passages.map((passage) => passage.hash))];
  if (hashes.length === 0) return {};
  const { data, error } = await createAdminClient()
    .from("passage_resonances")
    .select("passage_hash, user_id")
    .eq("episode_id", episodeId)
    .in("passage_hash", hashes)
    .limit(MAX_MARK_ROWS);
  if (error) {
    console.error("[resonance] loadPassageMarks failed", { episodeId, message: error.message });
    return {};
  }
  return (data ?? []).reduce<Record<string, PassageMark>>((marks, row) => {
    const hash = row.passage_hash as string;
    const previous = marks[hash] ?? { count: 0, mine: false };
    return {
      ...marks,
      [hash]: { count: previous.count + 1, mine: previous.mine || (viewerId !== null && row.user_id === viewerId) },
    };
  }, {});
}

export type ToggleResult = { ok: true; mark: PassageMark } | { ok: false; status: 404; error: string };

async function markAfter(episodeId: string, hash: string, userId: string): Promise<PassageMark> {
  const { data, error } = await createAdminClient()
    .from("passage_resonances")
    .select("user_id")
    .eq("episode_id", episodeId)
    .eq("passage_hash", hash)
    .limit(MAX_MARK_ROWS);
  if (error) throw new Error(`讀取記號失敗：${error.message}`);
  const rows = data ?? [];
  return { count: rows.length, mine: rows.some((row) => row.user_id === userId) };
}

async function findPassage(slug: string, hash: string): Promise<{ episodeId: string; passage: Passage } | null> {
  const article = await loadSharedArticle(slug);
  const passage = article?.passages.find((item) => item.hash === hash);
  return article && passage ? { episodeId: article.episodeId, passage } : null;
}

/** 留下記號（每人每段一個；重複按視為已留） */
export async function addResonance(userId: string, slug: string, hash: string): Promise<ToggleResult> {
  const found = await findPassage(slug, hash);
  if (!found) return { ok: false, status: 404, error: "這段已經不在了" };
  const { error } = await createAdminClient().from("passage_resonances").insert({
    episode_id: found.episodeId,
    user_id: userId,
    passage_hash: hash,
    passage_index: found.passage.index,
    passage_text: found.passage.text,
  });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw new Error(`留下記號失敗：${error.message}`);
  return { ok: true, mark: await markAfter(found.episodeId, hash, userId) };
}

/** 收回自己的記號（只刪自己的那一列） */
export async function removeResonance(userId: string, slug: string, hash: string): Promise<ToggleResult> {
  const article = await loadSharedArticle(slug);
  if (!article) return { ok: false, status: 404, error: "這篇已經看不到了" };
  const { error } = await createAdminClient()
    .from("passage_resonances")
    .delete()
    .eq("episode_id", article.episodeId)
    .eq("passage_hash", hash)
    .eq("user_id", userId);
  if (error) throw new Error(`收回記號失敗：${error.message}`);
  return { ok: true, mark: await markAfter(article.episodeId, hash, userId) };
}
