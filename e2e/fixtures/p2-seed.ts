/**
 * P2 E2E 用的測試資料：以 service role 直接寫入本地 Supabase（集數、正文、排程、訂閱）。
 * 全部掛在測試使用者名下，測試結束由 accounts fixture 依 user_id 一併刪除。
 */

import { serviceRoleKey, supabaseUrl } from "./env";

type Row = Record<string, unknown>;

async function insert<T = Row>(table: string, rows: Row | Row[]): Promise<T[]> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`[p2 seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T[];
}

const BLOG = "# {title}\n\n燈亮的時候我沒有馬上站起來。旁邊的人都在穿外套了，我還坐著。\n\n這部片其實沒發生什麼大事。";

export interface SeedEpisode {
  title: string;
  status?: string;
  publishedAt?: string | null;
  shareSlug?: string | null;
  visibility?: string;
  audioUrl?: string | null;
  workId?: string | null;
  /** 沒給就不建正文（還在轉錄／整理） */
  blog?: { edited?: boolean } | null;
  transcript?: string | null;
  scheduledAt?: string | null;
}

/** 建一篇集數（source=audio）＋可選的正文、逐字稿、排程中的 Threads/FB 貼文；回傳 episode id */
export async function seedEpisode(userId: string, seed: SeedEpisode): Promise<string> {
  const [episode] = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: seed.title,
    source: "audio",
    status: seed.status ?? "transcribed",
    audio_url: seed.audioUrl ?? null,
    work_id: seed.workId ?? null,
    published_at: seed.publishedAt ?? null,
    share_slug: seed.shareSlug ?? null,
  });
  if (seed.visibility) await patch("episodes", `id=eq.${episode.id}`, { visibility: seed.visibility });
  if (seed.transcript) {
    await insert("transcripts", { episode_id: episode.id, full_text: seed.transcript, segments: [] });
  }
  if (seed.blog) {
    const body = BLOG.replace("{title}", seed.title);
    await insert("contents", {
      user_id: userId,
      episode_id: episode.id,
      platform: "blog",
      body: seed.blog.edited ? `${body}\n\n（改過）` : body,
      original_body: body,
      status: "draft",
    });
  }
  if (seed.scheduledAt) {
    await insert(
      "contents",
      ["threads", "facebook"].map((platform) => ({
        user_id: userId,
        episode_id: episode.id,
        platform,
        body: "貼文",
        original_body: "貼文",
        status: "scheduled",
        scheduled_at: seed.scheduledAt,
      })),
    );
  }
  return episode.id;
}

/** 一筆已說的視聽日誌，連到指定集數（驗刪草稿後日誌狀態） */
export async function seedSaidJournal(userId: string, episodeId: string, title: string): Promise<string> {
  const [row] = await insert<{ id: string }>("journal_entries", {
    user_id: userId,
    work_title_fallback: title,
    experienced_at: new Date().toISOString(),
    status: "said",
    episode_id: episodeId,
    remind_at: new Date(Date.now() - 60_000).toISOString(),
  });
  return row.id;
}

export async function patch(table: string, query: string, values: Row): Promise<void> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(`[p2 seed] patch ${table} → ${response.status}`);
}

/** 建一個 RSS 訂閱與最近一集（不抓網路） */
export async function seedShow(
  userId: string,
  show: { title: string; author: string; url: string; episodeNumber: number; airedAt: string; season?: number },
): Promise<string> {
  const [feed] = await insert<{ id: string }>("feeds", {
    user_id: userId,
    url: show.url,
    title: show.title,
    author: show.author,
  });
  await insert("episodes", {
    user_id: userId,
    title: `${show.title} 第 ${show.episodeNumber} 集`,
    source: "rss",
    status: "transcribed",
    feed_id: feed.id,
    guid: `${show.url}#${show.episodeNumber}`,
    aired_at: show.airedAt,
    episode_number: show.episodeNumber,
    season_number: show.season ?? null,
  });
  return feed.id;
}

/** 建一集 RSS 單集（含訂閱，不抓網路）；回傳 episode id（閱讀頁 /episodes/<id>/read 用） */
export async function seedRssEpisode(userId: string, title: string): Promise<string> {
  const url = `https://e2e.example.com/rss/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.xml`;
  const [feed] = await insert<{ id: string }>("feeds", { user_id: userId, url, title, author: "測試主持人" });
  const [episode] = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: `${title} 第 1 集`,
    source: "rss",
    status: "transcribed",
    feed_id: feed.id,
    guid: `${url}#1`,
    aired_at: new Date().toISOString(),
    episode_number: 1,
  });
  return episode.id;
}
