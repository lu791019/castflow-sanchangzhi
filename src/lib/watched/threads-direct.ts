/**
 * 直接發到 Threads（Q-74 B、Q-82）：Meta 送審通過前只給站長（Dex）用，權杖存在全站 settings.meta_threads（單人時代的設定）。
 * 其他人一律走網頁發文連結／複製。權杖只在 server 端讀，不回傳到畫面。
 */

import { isSiteOwner } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ThreadsDirectConfig {
  userId: string;
  accessToken: string;
}

function toConfig(value: unknown): ThreadsDirectConfig | null {
  const raw = value as { user_id?: unknown; access_token?: unknown } | null;
  if (typeof raw?.user_id !== "string" || typeof raw.access_token !== "string") return null;
  if (!raw.user_id || !raw.access_token) return null;
  return { userId: raw.user_id, accessToken: raw.access_token };
}

/** 本人是站長且已設定 Threads 權杖才回設定；否則 null */
export async function loadThreadsDirectConfig(userId: string): Promise<ThreadsDirectConfig | null> {
  if (!(await isSiteOwner(userId))) return null;
  const { data, error } = await createAdminClient().from("settings").select("value").eq("key", "meta_threads").maybeSingle();
  if (error) throw new Error(`讀取 Threads 設定失敗：${error.message}`);
  return toConfig((data as { value: unknown } | null)?.value ?? null);
}

export { toConfig as parseThreadsDirectConfig };
