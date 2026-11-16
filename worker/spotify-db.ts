/** Spotify 收聽紀錄提醒的 DB 存取（service role；migration 041：spotify_connections、notifications.url／dedupe_key） */

import type { ListenPrompt } from "../src/lib/spotify/listening.ts";
import { encryptToken } from "../src/lib/spotify/token-crypto.ts";
import type { WorkerDb } from "./db.ts";
import type { ListenConnection } from "./spotify-listen.ts";

/** 一輪最多拉幾個人（允許名單最多 5 人，留餘裕） */
const DUE_BATCH_LIMIT = 20;

/** active、從沒拉過或上次拉取早於 intervalMs 前的人（worker 重啟不會馬上重拉） */
export async function listDueConnections(db: WorkerDb, intervalMs: number, now: Date = new Date()): Promise<ListenConnection[]> {
  const before = new Date(now.getTime() - intervalMs).toISOString();
  const { data, error } = await db
    .from("spotify_connections")
    .select("user_id, refresh_token_enc")
    .eq("status", "active")
    .or(`last_polled_at.is.null,last_polled_at.lt.${before}`)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(DUE_BATCH_LIMIT);
  if (error) throw new Error(`讀取 Spotify 連結失敗：${error.message}`);
  return ((data ?? []) as Array<{ user_id: string; refresh_token_enc: string }>).map((row) => ({
    userId: row.user_id,
    refreshTokenEnc: row.refresh_token_enc,
  }));
}

export async function saveRotatedRefreshToken(db: WorkerDb, userId: string, refreshToken: string, key: Buffer): Promise<void> {
  const { error } = await db
    .from("spotify_connections")
    .update({ refresh_token_enc: encryptToken(refreshToken, userId, key), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(`更新 refresh token 失敗：${error.message}`);
}

export async function markConnectionPolled(db: WorkerDb, userId: string, lastError: string | null): Promise<void> {
  const { error } = await db
    .from("spotify_connections")
    .update({ last_polled_at: new Date().toISOString(), last_error: lastError })
    .eq("user_id", userId);
  if (error) throw new Error(`寫入 last_polled_at 失敗：${error.message}`);
}

export async function markConnectionRevoked(db: WorkerDb, userId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from("spotify_connections")
    .update({ status: "revoked", last_error: reason.slice(0, 500), last_polled_at: now, updated_at: now })
    .eq("user_id", userId);
  if (error) throw new Error(`標記 Spotify 連結撤銷失敗：${error.message}`);
}

/** unique(user_id, dedupe_key)：同張專輯同一天已問過就不建，回 false */
export async function insertListenPrompt(db: WorkerDb, userId: string, prompt: ListenPrompt): Promise<boolean> {
  const { data, error } = await db
    .from("notifications")
    .upsert(
      { kind: "listen_prompt", user_id: userId, title: prompt.title, body: prompt.body, url: prompt.url, dedupe_key: prompt.dedupeKey },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`寫入收聽提醒失敗：${error.message}`);
  return (data ?? []).length > 0;
}
