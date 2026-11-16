/**
 * 需要擁有者身分的讀取（server only）。
 * 取代原本在瀏覽器用 anon client 依 id 直查的頁面：一律先確認集數／風格屬於目前使用者，
 * 不屬於自己（或 id 非法）回 null，呼叫端轉成 404，不透露資料是否存在。
 * client 由呼叫端注入（正式環境為 service role），方便以假 DB 測試。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Content, StyleDimensions } from "@/lib/types";

export const TRANSCRIPT_PREVIEW_CHARS = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface EpisodeEditData {
  episode: { id: string; title: string };
  contents: Content[];
}

export interface EpisodeGenerateData {
  episode: { id: string; title: string; status: string };
  transcriptPreview: string;
  hasContent: boolean;
}

export interface OwnedStyle {
  id: string;
  name: string;
  platform: string;
  exampleCount: number;
  dimensions: StyleDimensions;
}

interface QueryError {
  message: string;
}

function fail(what: string, error: QueryError): never {
  throw new Error(`讀取${what}失敗：${error.message}`);
}

async function findOwnedEpisode<T extends { id: string }>(
  db: SupabaseClient,
  userId: string,
  episodeId: string,
  columns: string,
): Promise<T | null> {
  if (!isUuid(episodeId)) return null;
  const { data, error } = await db
    .from("episodes")
    .select(columns)
    .eq("id", episodeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("集數", error);
  return (data as T | null) ?? null;
}

export async function loadEpisodeEditData(
  db: SupabaseClient,
  userId: string,
  episodeId: string,
): Promise<EpisodeEditData | null> {
  const episode = await findOwnedEpisode<{ id: string; title: string }>(
    db,
    userId,
    episodeId,
    "id, title",
  );
  if (!episode) return null;

  const { data, error } = await db
    .from("contents")
    .select("*")
    .eq("episode_id", episodeId)
    .order("platform");
  if (error) fail("文案", error);

  return { episode: { id: episode.id, title: episode.title }, contents: (data ?? []) as Content[] };
}

export async function loadEpisodeGenerateData(
  db: SupabaseClient,
  userId: string,
  episodeId: string,
): Promise<EpisodeGenerateData | null> {
  const episode = await findOwnedEpisode<{ id: string; title: string; status: string }>(
    db,
    userId,
    episodeId,
    "id, title, status",
  );
  if (!episode) return null;

  const [transcriptResult, contentResult] = await Promise.all([
    db
      .from("transcripts")
      .select("full_text")
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("contents").select("id").eq("episode_id", episodeId).limit(1),
  ]);
  if (transcriptResult.error) fail("逐字稿", transcriptResult.error);
  if (contentResult.error) fail("文案", contentResult.error);

  const fullText = (transcriptResult.data as { full_text: string } | null)?.full_text ?? "";
  return {
    episode: { id: episode.id, title: episode.title, status: episode.status },
    transcriptPreview: fullText.slice(0, TRANSCRIPT_PREVIEW_CHARS),
    hasContent: (contentResult.data ?? []).length > 0,
  };
}

export async function loadOwnedStyle(
  db: SupabaseClient,
  userId: string,
  styleId: string,
): Promise<OwnedStyle | null> {
  if (!isUuid(styleId)) return null;
  const { data, error } = await db
    .from("style_dnas")
    .select("id, name, platform, source_example_count, dimensions")
    .eq("id", styleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("風格", error);
  if (!data) return null;

  const row = data as {
    id: string;
    name: string;
    platform: string;
    source_example_count: number;
    dimensions: StyleDimensions;
  };
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    exampleCount: row.source_example_count,
    dimensions: row.dimensions,
  };
}
