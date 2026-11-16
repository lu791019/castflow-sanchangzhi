/**
 * 文章匯入的存取層（service role；每個查詢都帶 user_id）。
 * 寫入：episodes（筆名、公開、已發佈、原文網址）→ transcripts（全文）→ contents（blog 正文）；
 * 後兩步失敗就刪掉剛建的 episode，不留半篇。
 */

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareSlug } from "@/lib/proof/publish";
import { DuplicateImportError, type ImportRepo, type ImportedEpisodeRow, type NewImportedEpisode } from "./service";

const PG_UNIQUE_VIOLATION = "23505";
const ORIGINAL_URL_INDEX = "episodes_user_original_url_key";
const SLUG_ATTEMPTS = 5;

interface PgError {
  code?: string;
  message: string;
}

async function findImported(userId: string, originalUrl: string): Promise<ImportedEpisodeRow | null> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("title, share_slug")
    .eq("user_id", userId)
    .eq("original_url", originalUrl)
    .maybeSingle();
  if (error) throw new Error(`查詢是否搬過失敗：${error.message}`);
  return data ? { title: data.title as string, shareSlug: (data.share_slug as string | null) ?? null } : null;
}

async function workExists(workId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("works").select("id").eq("id", workId).maybeSingle();
  if (error) throw new Error(`查詢作品失敗：${error.message}`);
  return Boolean(data);
}

function episodeRow(row: NewImportedEpisode, shareSlug: string) {
  return {
    user_id: row.userId,
    title: row.title,
    source: "text",
    audio_url: null,
    status: "transcribed",
    work_id: row.workId,
    visibility: "public",
    byline: "pen_name",
    generate_social: false,
    share_slug: shareSlug,
    // 文章頁的日期與期數月份看 created_at：匯入文章以原文日期為準
    published_at: row.publishedAt,
    created_at: row.publishedAt,
    original_url: row.originalUrl,
  };
}

async function insertEpisode(row: NewImportedEpisode): Promise<{ episodeId: string; shareSlug: string }> {
  const supabase = createAdminClient();
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const shareSlug = generateShareSlug((size) => randomBytes(size));
    const { data, error } = await supabase.from("episodes").insert(episodeRow(row, shareSlug)).select("id").single();
    if (!error && data) return { episodeId: data.id as string, shareSlug };
    const pg = error as PgError | null;
    if (pg?.code === PG_UNIQUE_VIOLATION && pg.message.includes(ORIGINAL_URL_INDEX)) throw new DuplicateImportError();
    if (pg?.code !== PG_UNIQUE_VIOLATION) throw new Error(`建立文章失敗：${pg?.message ?? "unknown"}`);
    // share_slug 撞號：換一個再試
  }
  throw new Error("產生文章連結失敗，請再試一次");
}

async function insertBody(row: NewImportedEpisode, episodeId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error: txError } = await supabase.from("transcripts").insert({
    episode_id: episodeId,
    full_text: row.plainText,
    segments: [{ start: 0, end: 0, text: row.plainText }],
    language: "zh-TW",
  });
  if (txError) throw new Error(`寫入全文失敗：${txError.message}`);
  const { error: contentError } = await supabase.from("contents").insert({
    user_id: row.userId,
    episode_id: episodeId,
    platform: "blog",
    body: row.markdown,
    original_body: row.markdown,
    status: "draft",
  });
  if (contentError) throw new Error(`寫入正文失敗：${contentError.message}`);
}

async function insertImported(row: NewImportedEpisode): Promise<{ episodeId: string; shareSlug: string }> {
  const saved = await insertEpisode(row);
  try {
    await insertBody(row, saved.episodeId);
    return saved;
  } catch (error) {
    const { error: rollbackError } = await createAdminClient()
      .from("episodes")
      .delete()
      .eq("id", saved.episodeId)
      .eq("user_id", row.userId);
    if (rollbackError) console.error("[import] 回滾文章失敗", { episodeId: saved.episodeId, message: rollbackError.message });
    throw error;
  }
}

export function createSupabaseImportRepo(): ImportRepo {
  return { findImported, workExists, insertImported };
}
