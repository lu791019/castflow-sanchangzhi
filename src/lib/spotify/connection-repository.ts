/**
 * spotify_connections 讀寫（server only，service role；migration 041）：
 * 表對使用者端（anon／authenticated）完全不開，連自己的列都讀不到；refresh token 只存加密後的密文。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, tokenKeyFromEnv } from "./token-crypto";

export interface SpotifyConnectionStatus {
  connected: boolean;
  /** 授權被撤銷（worker 換權杖拿到 invalid_grant）→ 設定頁請他重新連結 */
  revoked: boolean;
}

export const NOT_CONNECTED: SpotifyConnectionStatus = { connected: false, revoked: false };

export function warnSpotify(title: string, detail: string): void {
  console.error(`[spotify] ${title}`, detail);
  void getServerNotify()("warn", title, detail).catch(() => undefined);
}

export async function loadSpotifyConnection(userId: string): Promise<SpotifyConnectionStatus> {
  const { data, error } = await createAdminClient().from("spotify_connections").select("status").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`讀取 Spotify 連結失敗：${error.message}`);
  if (!data) return NOT_CONNECTED;
  const status = (data as { status: string }).status;
  return { connected: status === "active", revoked: status === "revoked" };
}

/** callback 成功：加密 refresh token 後 upsert（重新連結蓋掉舊的、狀態回 active） */
export async function saveSpotifyConnection(userId: string, refreshToken: string, scope: string): Promise<void> {
  const sealed = encryptToken(refreshToken, userId, tokenKeyFromEnv());
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("spotify_connections")
    .upsert(
      { user_id: userId, refresh_token_enc: sealed, scope, status: "active", last_error: null, connected_at: now, updated_at: now },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`儲存 Spotify 連結失敗：${error.message}`);
}

/** 解除連結：整列刪掉（含密文） */
export async function deleteSpotifyConnection(userId: string): Promise<void> {
  const { error } = await createAdminClient().from("spotify_connections").delete().eq("user_id", userId);
  if (error) throw new Error(`解除 Spotify 連結失敗：${error.message}`);
}
