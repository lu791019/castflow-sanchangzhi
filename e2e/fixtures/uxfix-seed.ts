/**
 * uxfix E2E：以 service role 直接種本測試帳號的文章、逐字稿、正文與日誌（清理交給 accounts fixture 刪整個使用者）。
 */

import { serviceRoleKey, supabaseUrl } from "./env";

const HOUR = 60 * 60 * 1000;

async function insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[uxfix seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [created] = (await response.json()) as T[];
  return created;
}

interface EpisodeSeed {
  title?: string;
  source?: string;
  transcript?: string;
  blogBody?: string;
  workId?: string | null;
  shareSlug?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  /** 另外種 threads／facebook／instagram／linkedin／newsletter 五個平台貼文 */
  socialPosts?: boolean;
}

const SOCIAL_PLATFORMS = ["threads", "facebook", "instagram", "linkedin", "newsletter"];

/** 一篇文章（可帶逐字稿與 blog 正文）；回傳 episode id */
export async function seedEpisode(userId: string, seed: EpisodeSeed): Promise<string> {
  const episode = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: seed.title ?? "散場隨筆",
    source: seed.source ?? "audio",
    status: "transcribed",
    work_id: seed.workId ?? null,
    share_slug: seed.shareSlug ?? null,
    published_at: seed.publishedAt ?? null,
    visibility: "public",
    ...(seed.createdAt ? { created_at: seed.createdAt } : {}),
  });
  if (seed.transcript !== undefined) {
    await insert("transcripts", { episode_id: episode.id, full_text: seed.transcript });
  }
  if (seed.blogBody !== undefined) {
    await insert("contents", {
      user_id: userId,
      episode_id: episode.id,
      platform: "blog",
      body: seed.blogBody,
      original_body: seed.blogBody,
      status: "draft",
    });
  }
  if (seed.socialPosts) {
    for (const platform of SOCIAL_PLATFORMS) {
      await insert("contents", { user_id: userId, episode_id: episode.id, platform, body: `${platform} 貼文`, status: "draft" });
    }
  }
  return episode.id;
}

/** hoursAgo 小時前在電影院看完、還沒說的日誌 */
export async function seedRecordedEntry(userId: string, workId: string, hoursAgo: number): Promise<string> {
  // 當時就記下的（created_at 同看的時間）：不會撞到「2 小時內再記同一部」的確認（UX-26）
  const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  const row = await insert<{ id: string }>("journal_entries", {
    user_id: userId,
    work_id: workId,
    experienced_at: at,
    created_at: at,
    venue: "cinema",
    status: "recorded",
  });
  return row.id;
}
