/**
 * 作者的來信（server only，client 由呼叫端注入）。
 * 一律以 author_id = 目前登入者過濾，且排除 suppressed（被封鎖者寄來的）：別人的信、不存在的信都回 null。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/auth/owned-reads";
import { parseArticle } from "@/lib/share/article";
import type { LetterStatus } from "./format";
import type { LetterRowPatch, LetterState } from "./policy";

const INBOX_LIMIT = 200;
const COLUMNS =
  "id, episode_id, sender_id, body, reply, status, published_at, read_at, reported_at, created_at";

export interface InboxLetter extends LetterState {
  id: string;
  episode_id: string;
  sender_id: string;
  body: string;
  status: LetterStatus;
  published_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface LetterArticle {
  title: string;
  slug: string | null;
}

interface QueryError {
  message: string;
}

function fail(what: string, error: QueryError): never {
  throw new Error(`${what}失敗：${error.message}`);
}

export async function listInbox(db: SupabaseClient, authorId: string): Promise<InboxLetter[]> {
  const { data, error } = await db
    .from("letters")
    .select(COLUMNS)
    .eq("author_id", authorId)
    .eq("suppressed", false)
    .order("created_at", { ascending: false })
    .limit(INBOX_LIMIT);
  if (error) fail("讀取來信", error);
  return (data ?? []) as InboxLetter[];
}

export async function countUnread(db: SupabaseClient, authorId: string): Promise<number> {
  const { count, error } = await db
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("author_id", authorId)
    .eq("suppressed", false)
    .is("read_at", null);
  if (error) fail("讀取未讀數", error);
  return count ?? 0;
}

export async function findInboxLetter(
  db: SupabaseClient,
  authorId: string,
  letterId: string,
): Promise<InboxLetter | null> {
  if (!isUuid(letterId)) return null;
  const { data, error } = await db
    .from("letters")
    .select(COLUMNS)
    .eq("id", letterId)
    .eq("author_id", authorId)
    .eq("suppressed", false)
    .maybeSingle();
  if (error) fail("讀取來信", error);
  return (data as InboxLetter | null) ?? null;
}

/** 打開一封信＝讀過；已讀過不再改時間 */
export async function markRead(db: SupabaseClient, authorId: string, letterId: string): Promise<void> {
  const { error } = await db
    .from("letters")
    .update({ read_at: new Date().toISOString() })
    .eq("id", letterId)
    .eq("author_id", authorId)
    .is("read_at", null);
  if (error) fail("標記已讀", error);
}

export async function updateInboxLetter(
  db: SupabaseClient,
  authorId: string,
  letterId: string,
  patch: LetterRowPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const { error } = await db
    .from("letters")
    .update(patch)
    .eq("id", letterId)
    .eq("author_id", authorId)
    .eq("suppressed", false);
  if (error) fail("更新來信", error);
}

/** 封鎖寄信人：之後寄給這位作者任何文章的信都不送達；已刊登的信一併撤成「只放在這裡」 */
export async function blockSender(db: SupabaseClient, authorId: string, senderId: string): Promise<void> {
  const { error } = await db
    .from("letter_blocks")
    .upsert({ author_id: authorId, blocked_id: senderId }, { onConflict: "author_id,blocked_id", ignoreDuplicates: true });
  if (error) fail("封鎖寄信人", error);
  const { error: withdrawError } = await db
    .from("letters")
    .update({ status: "kept", published_at: null })
    .eq("author_id", authorId)
    .eq("sender_id", senderId)
    .eq("status", "published");
  if (withdrawError) fail("撤下被封鎖者的信", withdrawError);
}

export async function unblockSender(db: SupabaseClient, authorId: string, senderId: string): Promise<void> {
  const { error } = await db.from("letter_blocks").delete().eq("author_id", authorId).eq("blocked_id", senderId);
  if (error) fail("解除封鎖", error);
}

/** 信寄往的文章標題（正文 # 標題優先，同分享頁）與分享網址 */
export async function loadLetterArticles(
  db: SupabaseClient,
  episodeIds: readonly string[],
): Promise<Map<string, LetterArticle>> {
  const ids = [...new Set(episodeIds)];
  const result = new Map<string, LetterArticle>();
  if (ids.length === 0) return result;
  const [episodes, contents] = await Promise.all([
    db.from("episodes").select("id, title, share_slug").in("id", ids),
    db.from("contents").select("episode_id, body").in("episode_id", ids).eq("platform", "blog"),
  ]);
  if (episodes.error) fail("讀取文章", episodes.error);
  if (contents.error) fail("讀取正文", contents.error);
  const bodies = new Map(
    ((contents.data ?? []) as Array<{ episode_id: string; body: string }>).map((row) => [row.episode_id, row.body]),
  );
  for (const row of (episodes.data ?? []) as Array<{ id: string; title: string; share_slug: string | null }>) {
    const body = bodies.get(row.id);
    const title = (body ? parseArticle(body).title : null) ?? row.title;
    result.set(row.id, { title, slug: row.share_slug });
  }
  return result;
}
