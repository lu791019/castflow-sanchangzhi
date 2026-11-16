/**
 * 以 service role 直打本地 Supabase（PostgREST / GoTrue admin / Storage）：查測試前置資料、清掉測試使用者。
 * 清理只接受 e2e+…@example.com 的帳號，避免誤刪真實使用者。
 */

import { isTestEmail, serviceRoleKey, supabaseUrl } from "./env";

type Json = Record<string, unknown>;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceRoleKey();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

const NETWORK_RETRIES = 3;

/** 雲端偶爾連線斷掉（fetch failed）：網路層錯誤重試，HTTP 錯誤不重試 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (attempt >= NETWORK_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetchWithRetry(`${supabaseUrl()}${path}`, {
    ...init,
    headers: headers((init.headers as Record<string, string>) ?? {}),
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`[e2e admin] ${init.method ?? "GET"} ${path} → ${response.status} ${body.slice(0, 300)}`);
  }
  return response;
}

/** PostgREST 查詢（例：rest("episodes", "select=id&user_id=eq.x")） */
export async function rest<T = Json>(table: string, query: string): Promise<T[]> {
  const response = await call(`/rest/v1/${table}?${query}`);
  return (await response.json()) as T[];
}

async function restDelete(table: string, query: string): Promise<void> {
  await call(`/rest/v1/${table}?${query}`, { method: "DELETE" });
}

/** 套件層級清理用（sweep.ts）：條件由呼叫端限縮到測試前綴 */
export async function restDeleteWhere(table: string, query: string): Promise<void> {
  if (!/(^|&)(slug|source_id)=like\.e2e-/.test(query)) throw new Error(`[e2e admin] 套件清理只接受 e2e- 前綴條件：${table}?${query}`);
  await restDelete(table, query);
}

export interface AuthUser {
  id: string;
  email: string;
}

export async function listTestUsers(): Promise<AuthUser[]> {
  const response = await call("/auth/v1/admin/users?per_page=1000");
  const body = (await response.json()) as { users?: AuthUser[] };
  return (body.users ?? []).filter((user) => isTestEmail(user.email));
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const users = await listTestUsers();
  return users.find((user) => user.email === email.toLowerCase())?.id ?? null;
}

/** 以 admin API 產生 magic link，回傳 token hash（新版登入信連結用的那個；帳號不存在就先建，email 已驗證） */
export async function generateMagicLinkTokenHash(email: string): Promise<string> {
  if (!isTestEmail(email)) throw new Error(`[e2e admin] 只對測試帳號產生登入連結：${email}`);
  if (!(await findUserIdByEmail(email))) {
    await call("/auth/v1/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, email_confirm: true }) });
  }
  const response = await call("/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const body = (await response.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const hash = body.properties?.hashed_token ?? body.hashed_token;
  if (!hash) throw new Error("[e2e admin] generate_link 沒有回 hashed_token");
  return hash;
}

/** 依 FK 由葉到根刪：通知 → 日誌 → 內容/轉錄 → 集數 → 其他個人設定 → 筆名 */
const USER_OWNED_TABLES = [
  "taste_profiles",
  "passage_resonances",
  "work_cover_submissions",
  "notifications",
  "journal_entries",
  "contents",
  "episodes",
  "push_subscriptions",
  "feeds",
  "writing_rules",
  "style_examples",
  "style_dnas",
  "platform_templates",
] as const;

async function deleteEpisodeChildren(userId: string): Promise<void> {
  const episodes = await rest<{ id: string }>("episodes", `select=id&user_id=eq.${userId}`);
  if (episodes.length === 0) return;
  const ids = `in.(${episodes.map((episode) => episode.id).join(",")})`;
  // transcripts / episode_readings 沒有 user_id，靠 episode_id 刪（FK 也有 cascade，這裡明確刪一次）
  await restDelete("episode_readings", `episode_id=${ids}`);
  await restDelete("transcripts", `episode_id=${ids}`);
}

async function deleteUserAudio(userId: string): Promise<void> {
  const prefix = `episodes/${userId}`;
  const response = await call("/storage/v1/object/list/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (response.status === 404) return;
  const objects = (await response.json()) as { name: string }[];
  if (objects.length === 0) return;
  await call("/storage/v1/object/audio", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: objects.map((object) => `${prefix}/${object.name}`) }),
  });
}

/** 測試帳號送過的補封面（轉存在 covers 桶）：測試中途掛掉時 spec 自己的清理跑不到，這裡收 */
async function deleteUserCoverObjects(userId: string): Promise<void> {
  const prefix = `${supabaseUrl()}/storage/v1/object/public/covers/`;
  const rows = await rest<{ url: string }>("work_cover_submissions", `select=url&user_id=eq.${userId}`);
  const paths = rows.flatMap((row) => (row.url.startsWith(prefix) ? [row.url.slice(prefix.length)] : []));
  if (paths.length === 0) return;
  await call("/storage/v1/object/covers", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}

/** 刪掉一位測試使用者的所有資料與帳號 */
export async function deleteTestUser(user: AuthUser): Promise<void> {
  if (!isTestEmail(user.email)) {
    throw new Error(`[e2e admin] 拒絕刪除非測試帳號 ${user.email}`);
  }
  await deleteEpisodeChildren(user.id);
  await deleteUserCoverObjects(user.id);
  for (const table of USER_OWNED_TABLES) {
    await restDelete(table, `user_id=eq.${user.id}`);
  }
  await restDelete("profiles", `id=eq.${user.id}`);
  // settings 的每人設定以「<名稱>:<userId>」為 key（提醒設定、問卷挑的作品）
  await restDelete("settings", `key=like.*:${user.id}`);
  await deleteUserAudio(user.id);
  await call(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
}

/** 這位使用者的集數與日誌用到的作品 id（刪帳號前呼叫，之後交給 deleteWorkIfUnused） */
export async function workIdsUsedBy(userId: string): Promise<string[]> {
  const [episodes, journals] = await Promise.all([
    rest<{ work_id: string | null }>("episodes", `select=work_id&user_id=eq.${userId}&work_id=not.is.null`),
    rest<{ work_id: string | null }>("journal_entries", `select=work_id&user_id=eq.${userId}&work_id=not.is.null`),
  ]);
  return [...new Set([...episodes, ...journals].flatMap((row) => (row.work_id ? [row.work_id] : [])))];
}

/**
 * 刪掉測試期間新建的作品：只刪 createdSince 之後建立、且沒被任何集數／日誌引用的。
 * 雲端作品表有真資料：測試挑到既有作品（同一部 TMDB 電影）時 trackWork 也會登記到它，靠建立時間擋掉，絕不刪舊作品。
 */
export async function deleteWorkIfUnused(workId: string, createdSince: Date): Promise<void> {
  const [work] = await rest<{ created_at: string }>("works", `select=created_at&id=eq.${workId}`);
  if (!work || new Date(work.created_at).getTime() < createdSince.getTime()) return;
  const [episodes, journals] = await Promise.all([
    rest("episodes", `select=id&work_id=eq.${workId}&limit=1`),
    rest("journal_entries", `select=id&work_id=eq.${workId}&limit=1`),
  ]);
  if (episodes.length > 0 || journals.length > 0) return;
  await restDelete("works", `id=eq.${workId}`);
}

/** 清掉上次中斷殘留的測試帳號（globalSetup / globalTeardown 用） */
export async function sweepTestUsers(): Promise<number> {
  const users = await listTestUsers();
  for (const user of users) await deleteTestUser(user);
  return users.length;
}
