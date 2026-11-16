/**
 * 共鳴／同場 E2E 測試資料：以 service role 建測試帳號（不經登入）、筆名、已發佈文章、共鳴記號。
 * 帳號 email 一律由 accounts.newEmail 產生，測試結束由 accounts fixture 依 user_id 刪除（含 passage_resonances）。
 */

import { createHash } from "node:crypto";
import { patch } from "./p2-seed";
import { serviceRoleKey, supabaseUrl } from "./env";

type Row = Record<string, unknown>;

const RETRIES = 3;

/** 本地 Supabase 被其他 agent 壓滿時偶爾 504：重試幾次 */
async function call(path: string, init: RequestInit): Promise<Response> {
  const key = serviceRoleKey();
  let response: Response | null = null;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    response = await fetch(`${supabaseUrl()}${path}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  if (!response) throw new Error(`[p3res seed] ${init.method} ${path} 沒有回應`);
  if (!response.ok) throw new Error(`[p3res seed] ${init.method} ${path} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response;
}

async function insert<T = Row>(table: string, row: Row): Promise<T> {
  const response = await call(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  const [created] = (await response.json()) as T[];
  return created;
}

/** 建已驗證的測試帳號並取筆名（筆名全站唯一，加亂數尾碼） */
export async function seedUser(email: string, penBase: string): Promise<{ id: string; penName: string }> {
  const response = await call("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const { id } = (await response.json()) as { id: string };
  const penName = `${penBase}${Math.random().toString(36).slice(2, 5)}`;
  await insert("profiles", { id, pen_name: penName });
  return { id, penName };
}

export async function seedWorkRow(title: string): Promise<{ id: string; slug: string }> {
  const slug = `e2e-p3res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return insert<{ id: string; slug: string }>("works", { kind: "movie", title, slug, year: 2015, region: "日本" });
}

export interface SeedArticle {
  workId: string;
  title: string;
  /** 正文段落（第一段 20–90 字會被抽成副標，不算「段」） */
  paragraphs: string[];
  pullQuote: string;
  saidAt: Date;
  byline?: "pen_name" | "anonymous";
  visibility?: "public" | "unlisted" | "private";
}

export async function seedArticle(userId: string, article: SeedArticle): Promise<{ id: string; slug: string }> {
  const slug = `p3r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const at = article.saidAt.toISOString();
  const episode = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: article.title,
    source: "text",
    status: "transcribed",
    work_id: article.workId,
    published_at: at,
    created_at: at,
    share_slug: slug,
    pull_quote: article.pullQuote,
  });
  await patch("episodes", `id=eq.${episode.id}`, {
    visibility: article.visibility ?? "public",
    byline: article.byline ?? "pen_name",
  });
  const body = `# ${article.title}\n\n${article.paragraphs.join("\n\n")}`;
  await insert("contents", { user_id: userId, episode_id: episode.id, platform: "blog", body, original_body: body, status: "draft" });
  return { id: episode.id, slug };
}

export function hashOf(text: string): string {
  return createHash("sha256").update(text.trim().replace(/\s+/g, " "), "utf8").digest("hex").slice(0, 16);
}

export async function seedMark(userId: string, episodeId: string, text: string, index: number, at: Date): Promise<void> {
  await insert("passage_resonances", {
    episode_id: episodeId,
    user_id: userId,
    passage_hash: hashOf(text),
    passage_index: index,
    passage_text: text,
    created_at: at.toISOString(),
  });
}
