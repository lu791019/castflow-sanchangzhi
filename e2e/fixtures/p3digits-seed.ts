/**
 * 全站阿拉伯數字 E2E 測試資料：場外作品（多日演出）、日誌紀錄、來信。
 * 帳號與文章沿用 p3res-seed；作品由 accounts.trackWork 清、日誌與來信隨使用者刪除（FK cascade）。
 */

import { serviceRoleKey, supabaseUrl } from "./env";

type Row = Record<string, unknown>;

async function insert<T = Row>(table: string, row: Row): Promise<T> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[p3digits seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [created] = (await response.json()) as T[];
  return created;
}

/** 多日演出（音樂祭）：event_date ～ event_end_date */
export async function seedLiveWork(title: string, start: string, end: string): Promise<{ id: string; slug: string }> {
  const slug = `e2e-p3digits-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return insert<{ id: string; slug: string }>("works", {
    kind: "live",
    title,
    slug,
    venue: "大佳河濱公園",
    event_date: start,
    event_end_date: end,
  });
}

export interface SeedJournal {
  workId: string | null;
  title: string;
  experiencedAt: Date;
  venue: "home" | "cinema" | "live" | "exhibition" | "commute" | "other";
  episodeId?: string;
}

export async function seedJournal(userId: string, entry: SeedJournal): Promise<void> {
  await insert("journal_entries", {
    user_id: userId,
    work_id: entry.workId,
    work_title_fallback: entry.workId ? null : entry.title,
    experienced_at: entry.experiencedAt.toISOString(),
    venue: entry.venue,
    status: entry.episodeId ? "said" : "recorded",
    episode_id: entry.episodeId ?? null,
  });
}

export interface SeedLetter {
  episodeId: string;
  senderId: string;
  authorId: string;
  body: string;
  published?: boolean;
  read?: boolean;
}

export async function seedLetter(letter: SeedLetter): Promise<{ id: string }> {
  const now = new Date().toISOString();
  return insert<{ id: string }>("letters", {
    episode_id: letter.episodeId,
    sender_id: letter.senderId,
    author_id: letter.authorId,
    body: letter.body,
    status: letter.published ? "published" : "none",
    published_at: letter.published ? now : null,
    read_at: letter.read || letter.published ? now : null,
  });
}
