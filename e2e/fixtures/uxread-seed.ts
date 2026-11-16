/**
 * uxread（閱讀面體驗收尾）E2E 測試資料：service role 建作品（可帶海報網址）；作者與文章沿用 p3idx-seed。
 * 作品走 accounts.trackWork（沒被引用就刪），帳號走 accounts.newEmail。
 */

import { serviceRoleKey, supabaseUrl } from "./env";

export { createArticle, createAuthor } from "./p3idx-seed";

export interface UxreadWork {
  kind: "movie" | "live";
  title: string;
  posterUrl?: string | null;
  venue?: string | null;
  eventDate?: string | null;
}

/** 建作品；回傳 id 與特輯網址用的 slug */
export async function createWorkWithSlug(work: UxreadWork): Promise<{ id: string; slug: string }> {
  const key = serviceRoleKey();
  const slug = `e2e-uxread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const response = await fetch(`${supabaseUrl()}/rest/v1/works`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      kind: work.kind,
      title: work.title,
      slug,
      poster_url: work.posterUrl ?? null,
      venue: work.venue ?? null,
      event_date: work.eventDate ?? null,
    }),
  });
  if (!response.ok) throw new Error(`[uxread seed] works → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [row] = (await response.json()) as Array<{ id: string }>;
  return { id: row.id, slug };
}
