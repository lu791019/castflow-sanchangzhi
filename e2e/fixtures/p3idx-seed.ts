/**
 * P3 索引 E2E 用的測試資料：service role 直接建帳號（含筆名）、作品、已發佈文章。
 * 帳號 email 一律走 accounts.newEmail（結束後刪），作品走 accounts.trackWork（沒被引用就刪）。
 */

import { serviceRoleKey, supabaseUrl } from "./env";
import { patch } from "./p2-seed";

type Row = Record<string, unknown>;

function headers(): Record<string, string> {
  const key = serviceRoleKey();
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
}

async function post<T>(path: string, body: Row | Row[]): Promise<T> {
  const response = await fetch(`${supabaseUrl()}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`[p3idx seed] POST ${path} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

/** 建一個已確認的 auth 帳號並取筆名；回傳 user id */
export async function createAuthor(email: string, penName: string): Promise<string> {
  const user = await post<{ id: string }>("/auth/v1/admin/users", { email, email_confirm: true });
  await post("/rest/v1/profiles", { id: user.id, pen_name: penName });
  return user.id;
}

/** 已登入使用者（真走 /login 建的）補一個指定筆名，方便斷言 */
export async function setPenName(userId: string, penName: string): Promise<void> {
  await patch("profiles", `id=eq.${userId}`, { pen_name: penName });
}

export interface SeedWork {
  kind: "movie" | "series" | "podcast_episode" | "live" | "exhibition";
  title: string;
  year?: number;
  podcastShow?: string;
  eventDate?: string;
}

export async function createWork(work: SeedWork): Promise<string> {
  const slug = `e2e-p3idx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await post<Array<{ id: string }>>("/rest/v1/works", {
    kind: work.kind,
    title: work.title,
    year: work.year ?? null,
    podcast_show: work.podcastShow ?? null,
    event_date: work.eventDate ?? null,
    slug,
  });
  return row.id;
}

export interface SeedArticle {
  title: string;
  /** 正文第一段之後的句子（搜尋命中用） */
  sentence?: string;
  workId?: string | null;
  byline?: "pen_name" | "anonymous";
  visibility?: "public" | "unlisted" | "private";
  /** false＝還沒發佈（草稿） */
  published?: boolean;
  publishedAt?: string;
}

/** 建一篇文章（source=text）＋ blog 正文；回傳 share slug（未發佈則 null） */
export async function createArticle(userId: string, seed: SeedArticle): Promise<string | null> {
  const published = seed.published ?? true;
  const shareSlug = published ? `p3idx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` : null;
  const [episode] = await post<Array<{ id: string }>>("/rest/v1/episodes", {
    user_id: userId,
    title: seed.title,
    source: "text",
    status: "transcribed",
    work_id: seed.workId ?? null,
    published_at: published ? (seed.publishedAt ?? new Date().toISOString()) : null,
    share_slug: shareSlug,
  });
  // 插入時 trigger 會套作者的預設公開範圍；這裡再明確寫一次
  await patch("episodes", `id=eq.${episode.id}`, {
    visibility: seed.visibility ?? "public",
    byline: seed.byline ?? "pen_name",
  });
  const body = `# ${seed.title}\n\n燈亮的時候我沒有馬上站起來。${seed.sentence ?? ""}\n\n這部片其實沒發生什麼大事。`;
  await post("/rest/v1/contents", {
    user_id: userId,
    episode_id: episode.id,
    platform: "blog",
    body,
    original_body: body,
    status: "draft",
  });
  return shareSlug;
}
