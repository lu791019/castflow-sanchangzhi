/**
 * OG 卡 E2E 測試資料：以 service role 寫入本地 Supabase（作品、已發佈文章、日誌）。
 * 全部掛在測試使用者名下，結束由 accounts fixture 依 user_id 刪除；作品用 trackWork 收尾。
 */

import { patch } from "./p2-seed";
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
  if (!response.ok) throw new Error(`[og seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [created] = (await response.json()) as T[];
  return created;
}

export interface OgSeedWork {
  kind: "movie" | "podcast_episode" | "live";
  title: string;
  posterUrl?: string | null;
  podcastShow?: string | null;
  episodeNumber?: number | null;
  venue?: string | null;
  eventDate?: string | null;
}

export async function seedWork(work: OgSeedWork): Promise<string> {
  const slug = `e2e-og-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const created = await insert<{ id: string }>("works", {
    kind: work.kind,
    title: work.title,
    slug,
    poster_url: work.posterUrl ?? null,
    podcast_show: work.podcastShow ?? null,
    episode_number: work.episodeNumber ?? null,
    venue: work.venue ?? null,
    event_date: work.eventDate ?? null,
  });
  return created.id;
}

export interface OgSeedArticle {
  workId: string | null;
  title: string;
  lede: string;
  pullQuote: string;
  visibility?: "public" | "unlisted" | "private";
  /** 有給就建一筆日誌（署名用時間差） */
  experiencedAt?: string;
  venue?: "home" | "cinema" | "live" | "commute";
  saidAt: string;
}

/** 已發佈文章；回傳 share slug */
export async function seedPublished(userId: string, article: OgSeedArticle): Promise<string> {
  const shareSlug = `og${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const episode = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: article.title,
    source: "audio",
    status: "transcribed",
    work_id: article.workId,
    published_at: article.saidAt,
    created_at: article.saidAt,
    share_slug: shareSlug,
    pull_quote: article.pullQuote,
  });
  await patch("episodes", `id=eq.${episode.id}`, { visibility: article.visibility ?? "public", byline: "pen_name" });
  const body = `# ${article.title}\n\n${article.lede}\n\n燈亮的時候我沒有馬上站起來。旁邊的人都在穿外套了，我還坐著。\n\n${article.pullQuote}`;
  await insert("contents", {
    user_id: userId,
    episode_id: episode.id,
    platform: "blog",
    body,
    original_body: body,
    status: "draft",
  });
  if (article.experiencedAt) {
    await insert("journal_entries", {
      user_id: userId,
      work_id: article.workId,
      work_title_fallback: article.workId ? null : article.title,
      experienced_at: article.experiencedAt,
      venue: article.venue ?? "home",
      status: "said",
      episode_id: episode.id,
    });
  }
  return shareSlug;
}
