/**
 * 在哪看／買票 E2E 用的測試資料：以 service role 直接寫入本地 Supabase。
 * 作品由呼叫端 trackWork 登記，結束時刪（work_links 隨作品 cascade）；日誌掛測試使用者名下一併刪除。
 */

import { serviceRoleKey, supabaseUrl } from "./env";

type Row = Record<string, unknown>;

async function insert<T = Row>(table: string, row: Row): Promise<T> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[links seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return ((await response.json()) as T[])[0];
}

export interface SeededWork {
  id: string;
  slug: string;
}

/** 電影作品；給 snapshot 就當成剛抓過的 TMDB 在哪看快取（24h 內不重抓） */
export function seedMovie(title: string, slug: string, snapshot: Row | null): Promise<SeededWork> {
  return insert<SeededWork>("works", {
    kind: "movie",
    title,
    slug,
    tmdb_id: snapshot ? 900_000_000 + Math.floor(Math.random() * 90_000_000) : null,
    watch_providers: snapshot,
    watch_providers_checked_at: snapshot ? new Date().toISOString() : null,
  });
}

/** 計畫中的日誌（接下來） */
export function seedPlan(userId: string, workId: string, at: Date): Promise<{ id: string }> {
  return insert<{ id: string }>("journal_entries", {
    user_id: userId,
    work_id: workId,
    experienced_at: at.toISOString(),
    venue: "live",
    status: "planned",
  });
}
