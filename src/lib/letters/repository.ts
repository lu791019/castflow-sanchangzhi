/**
 * 回信的資料存取（server only，client 由呼叫端注入：正式環境為 service role）。
 * 寄信端與文章頁：找文章、查自己寄過沒、寄信、讀者來函。作者端見 inbox.ts。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LetterEpisode } from "./policy";

const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const PG_UNIQUE_VIOLATION = "23505";
const PUBLISHED_LIMIT = 50;

export interface SlugEpisode extends LetterEpisode {
  share_slug: string;
}

export interface PublishedLetter {
  id: string;
  sender_id: string;
  body: string;
  reply: string | null;
  created_at: string;
}

interface QueryError {
  message: string;
  code?: string;
}

function fail(what: string, error: QueryError): never {
  throw new Error(`${what}失敗：${error.message}`);
}

export async function findEpisodeBySlug(db: SupabaseClient, slug: string): Promise<SlugEpisode | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const { data, error } = await db
    .from("episodes")
    .select("id, user_id, visibility, byline, published_at, share_slug")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) fail("讀取文章", error);
  return (data as SlugEpisode | null) ?? null;
}

/** 自己寄給這篇的信（每人每篇一封）；沒寄過回 null */
export async function findSentLetter(
  db: SupabaseClient,
  episodeId: string,
  senderId: string,
): Promise<{ created_at: string } | null> {
  const { data, error } = await db
    .from("letters")
    .select("created_at")
    .eq("episode_id", episodeId)
    .eq("sender_id", senderId)
    .maybeSingle();
  if (error) fail("讀取寄過的信", error);
  return (data as { created_at: string } | null) ?? null;
}

export async function isBlockedBy(db: SupabaseClient, authorId: string, senderId: string): Promise<boolean> {
  const { data, error } = await db
    .from("letter_blocks")
    .select("author_id")
    .eq("author_id", authorId)
    .eq("blocked_id", senderId)
    .maybeSingle();
  if (error) fail("讀取封鎖名單", error);
  return Boolean(data);
}

export interface NewLetter {
  episodeId: string;
  senderId: string;
  authorId: string;
  body: string;
  suppressed: boolean;
}

export type InsertResult = { ok: true; createdAt: string } | { ok: false; reason: "duplicate" };

export async function insertLetter(db: SupabaseClient, letter: NewLetter): Promise<InsertResult> {
  const { data, error } = await db
    .from("letters")
    .insert({
      episode_id: letter.episodeId,
      sender_id: letter.senderId,
      author_id: letter.authorId,
      body: letter.body,
      suppressed: letter.suppressed,
    })
    .select("created_at")
    .single();
  // 同時送兩次：DB 唯一鍵擋第二封
  if (error?.code === PG_UNIQUE_VIOLATION) return { ok: false, reason: "duplicate" };
  if (error) fail("寄信", error);
  return { ok: true, createdAt: (data as { created_at: string }).created_at };
}

/** 文章末尾的讀者來函：作者刊登、未被封鎖遮蔽的信，依刊登先後 */
export async function listPublishedLetters(db: SupabaseClient, episodeId: string): Promise<PublishedLetter[]> {
  const { data, error } = await db
    .from("letters")
    .select("id, sender_id, body, reply, created_at")
    .eq("episode_id", episodeId)
    .eq("status", "published")
    .eq("suppressed", false)
    .order("published_at", { ascending: true })
    .limit(PUBLISHED_LIMIT);
  if (error) fail("讀取讀者來函", error);
  return (data ?? []) as PublishedLetter[];
}

/** 寄信人的筆名（只認 profiles 真的有的筆名；沒有筆名的不顯示署名） */
export async function loadSenderPenNames(
  db: SupabaseClient,
  senderIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(senderIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from("profiles").select("id, pen_name").in("id", ids);
  if (error) fail("讀取寄信人筆名", error);
  return new Map(
    ((data ?? []) as Array<{ id: string; pen_name: string | null }>).flatMap((row) =>
      row.pen_name ? [[row.id, row.pen_name] as const] : [],
    ),
  );
}
