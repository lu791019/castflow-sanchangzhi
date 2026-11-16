/**
 * E2E 共用環境。測試會用 service role 種資料、刪測試資料，所以 Supabase 目標要明確：
 * - 本地（127.0.0.1／localhost）：照舊放行
 * - 雲端（<ref>.supabase.co）：必須設 E2E_REMOTE_REF=<ref> 明確同意才放行，否則拒絕（防止 env 指錯就對正式資料動手）
 * 遠端模式下：登入一律走 admin generateLink（不寄信）、會寄信的流程 skip、只動 e2e 前綴的資料。
 * 環境變數由 playwright.config.ts 以 @next/env 載入（與 next dev 相同的 .env 優先序）。
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[e2e] 缺少環境變數 ${name}（請確認 .env.development.local 有設 Supabase）`);
  }
  return value;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const REMOTE_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/;

/** 雲端 Supabase URL 的 project ref；不是 <ref>.supabase.co 回 null */
export function projectRefOf(url: string): string | null {
  return new URL(url).hostname.match(REMOTE_HOST_PATTERN)?.[1] ?? null;
}

/**
 * 擋掉沒被明確同意的 Supabase：本地放行；雲端要 E2E_REMOTE_REF 等於 URL 裡的 project ref；其他一律拒絕。
 * remoteRef 參數給單元測試用，預設讀 env。
 */
export function assertAllowedSupabaseUrl(url: string, remoteRef: string | undefined = process.env.E2E_REMOTE_REF): string {
  const { hostname } = new URL(url);
  if (LOCAL_HOSTS.has(hostname)) return url.replace(/\/$/, "");
  const ref = projectRefOf(url);
  if (!ref) throw new Error(`[e2e] Supabase URL 不是本地也不是 <ref>.supabase.co（${hostname}）：拒絕執行`);
  if (remoteRef?.trim() !== ref) {
    throw new Error(
      `[e2e] Supabase 指向雲端 ${ref}，但 E2E_REMOTE_REF 沒有明確同意這個 project（E2E 會種資料、刪測試資料）。確定要對它跑就設 E2E_REMOTE_REF=${ref}`,
    );
  }
  return url.replace(/\/$/, "");
}

/** 是否對雲端 Supabase 跑（遠端模式：不寄信、會寄信的 spec skip） */
export function isRemoteE2E(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !LOCAL_HOSTS.has(new URL(url).hostname));
}

/** 遠端模式 skip 的共同原因（寫在 spec 的 test.skip 裡） */
export const REMOTE_NO_MAIL_REASON = "遠端模式不寄信：雲端走 Resend 真寄，寄到 example.com 會退信、傷寄件信譽且吃額度（本機 Supabase＋Mailpit 才測）";

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3020);
export const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const MAILPIT_URL = (process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324").replace(/\/$/, "");

export function supabaseUrl(): string {
  return assertAllowedSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"));
}

export function serviceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * 本套件測試帳號 email 前綴；清理只認這個前綴，避免誤刪真實帳號或別人的臨時帳號。
 * 多個 worktree 同時跑 E2E 時用 E2E_EMAIL_PREFIX 各自分開（例：e2e+p2-），globalSetup 就不會清掉別人進行中的帳號。
 */
export const TEST_EMAIL_PREFIX = process.env.E2E_EMAIL_PREFIX ?? "e2e+pw-";
export const TEST_EMAIL_DOMAIN = "example.com";

export function isTestEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.startsWith(TEST_EMAIL_PREFIX) && email.endsWith(`@${TEST_EMAIL_DOMAIN}`));
}
