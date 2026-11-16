/**
 * music（音樂作品類別＋目錄全類別）E2E 測試資料：service role 建各類別作品；作者與文章沿用 p3idx-seed。
 * 作品走 accounts.trackWork（沒被引用就刪），帳號走 accounts.newEmail。
 */

import { rest } from "./admin";
import { serviceRoleKey, supabaseUrl } from "./env";

export { createArticle, createAuthor } from "./p3idx-seed";

export type SeedKind = "movie" | "series" | "podcast_episode" | "music" | "live" | "exhibition";

export async function createKindWork(kind: SeedKind, title: string): Promise<{ id: string; slug: string }> {
  const key = serviceRoleKey();
  const slug = `e2e-music-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const response = await fetch(`${supabaseUrl()}/rest/v1/works`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      kind,
      title,
      slug,
      credit: kind === "music" ? "測試樂團" : null,
      podcast_show: kind === "podcast_episode" ? title : null,
    }),
  });
  if (!response.ok) throw new Error(`[music seed] works → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [row] = (await response.json()) as Array<{ id: string }>;
  return { id: row.id, slug };
}

/** 介面建的專輯作品（slug＝music-<itunesId>）：查 id 給 trackWork；沒有回 null */
export async function musicWorkId(itunesId: number): Promise<string | null> {
  const rows = await rest<{ id: string }>("works", `select=id&slug=eq.music-${itunesId}`);
  return rows[0]?.id ?? null;
}
