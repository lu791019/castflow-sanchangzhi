/**
 * 登入流程。
 * - loginAsNewUser（一般 spec 用）：不寄信。service role 以 admin generateLink 拿 token hash，直接開本站
 *   /auth/callback?token_hash=…&type=email&next=…（與新版登入信的連結同一條路）→ 第一次登入會到 /onboarding/pen-name 取筆名。
 * - submitLoginAndFollowLink（要從 /login 頁走的 spec 用）：本地模式真走 GoTrue + Mailpit
 *   （填 email 送出 → Mailpit 取最新信 → 在同一個 browser context 開連結）；遠端模式不按「寄連結給我」，
 *   填好 email 後改走 admin generateLink（雲端走 Resend 真寄，寄到 example.com 會退信）。
 */

import { expect, type Page } from "@playwright/test";
import { generateMagicLinkTokenHash } from "./admin";
import { isRemoteE2E, MAILPIT_URL, TEST_EMAIL_DOMAIN, TEST_EMAIL_PREFIX } from "./env";

const MAIL_TIMEOUT_MS = 20_000;
const MAIL_POLL_MS = 500;

interface MailpitSummary {
  ID: string;
  Created: string;
}

let sequence = 0;

/** 每次呼叫都產生唯一測試帳號（時間戳 + 序號 + 亂數） */
export function uniqueTestEmail(tag: string): string {
  sequence += 1;
  const stamp = `${Date.now().toString(36)}${sequence}${Math.random().toString(36).slice(2, 6)}`;
  return `${TEST_EMAIL_PREFIX}${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
}

/** 筆名 1–20 字且全站唯一 */
export function uniquePenName(): string {
  return `測試${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`;
}

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`, init);
  if (!response.ok) throw new Error(`[e2e mailpit] ${path} → ${response.status}`);
  return (await response.json()) as T;
}

async function latestMessageId(email: string, since: number): Promise<string> {
  const deadline = Date.now() + MAIL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const query = encodeURIComponent(`to:"${email}"`);
    const { messages } = await mailpit<{ messages: MailpitSummary[] }>(`/api/v1/search?query=${query}`);
    const fresh = messages
      .filter((message) => new Date(message.Created).getTime() >= since - 2_000)
      .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
    if (fresh[0]) return fresh[0].ID;
    await new Promise((resolve) => setTimeout(resolve, MAIL_POLL_MS));
  }
  throw new Error(`[e2e mailpit] ${MAIL_TIMEOUT_MS}ms 內沒收到寄給 ${email} 的 magic link`);
}

/** 從信件 HTML 抓 verify 連結（HTML 內 & 被轉成 &amp;） */
export function extractVerifyLink(html: string): string {
  const match = html.match(/href="([^"]*verify[^"]*)"/i);
  if (!match) throw new Error("[e2e mailpit] 信裡找不到 verify 連結");
  return match[1].replace(/&amp;/g, "&");
}

export async function fetchMagicLink(email: string, since: number): Promise<string> {
  const id = await latestMessageId(email, since);
  const message = await mailpit<{ HTML: string }>(`/api/v1/message/${id}`);
  return extractVerifyLink(message.HTML);
}

/** 刪掉寄給測試帳號的信（Mailpit 是共用的，不留垃圾）；遠端模式沒有 Mailpit、也不寄信 */
export async function deleteMailsTo(email: string): Promise<void> {
  if (isRemoteE2E()) return;
  const query = encodeURIComponent(`to:"${email}"`);
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`, { method: "DELETE" });
}

/**
 * 等 React hydrate 完這個元素（DOM 節點掛上 __reactFiber / __reactProps）。
 * 受控 input 在 hydrate 前填的值會被 React 重設成空字串，送出就變成「email 看起來不太對」。
 */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    return Boolean(element && Object.keys(element).some((key) => key.startsWith("__reactProps")));
  }, selector);
}

/** 不寄信登入：admin generateLink 拿 token hash，開本站 callback（帶 next）。回傳後頁面停在 callback 導去的地方 */
export async function followAdminLoginLink(page: Page, email: string, next: string): Promise<void> {
  const tokenHash = await generateMagicLinkTokenHash(email);
  await page.goto(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=email&next=${encodeURIComponent(next)}`);
}

/**
 * 已在 /login 頁：填 email → 本地送出並開信中連結（同 context）；遠端不送出（不寄信），改開 admin 連結、next 沿用登入頁的。
 * 回傳後頁面停在 callback 導去的地方
 */
export async function submitLoginAndFollowLink(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/\/login/);
  const since = Date.now();
  await waitForHydration(page, 'input[name="email"]');
  const input = page.getByRole("textbox", { name: "EMAIL" });
  await input.fill(email);
  await expect(input).toHaveValue(email);
  if (isRemoteE2E()) {
    await followAdminLoginLink(page, email, new URL(page.url()).searchParams.get("next") ?? "/");
    return;
  }
  await page.getByRole("button", { name: "寄連結給我" }).click();
  await expect(page.getByRole("status").filter({ hasText: "去信箱點一下就好" })).toBeVisible();
  const link = await fetchMagicLink(email, since);
  await page.goto(link);
}

/** 取完筆名後的三題品味問卷（可跳過）：按「先跳過」直接去原本要去的地方 */
export async function skipTasteOnboarding(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding\/taste/);
  // hydrate 前按鈕沒有 onClick：按到離開問卷為止。「先跳過」會先存已選的作品再換頁，dev 冷編譯時換頁可能超過幾秒：
  // 上一輪已經在換頁的話不要再按（按鈕已不在，會卡到逾時）
  await expect(async () => {
    if (!new URL(page.url()).pathname.startsWith("/onboarding")) return;
    await page.getByRole("button", { name: "先跳過" }).click({ timeout: 3_000 });
    await page.waitForURL((url) => !url.pathname.startsWith("/onboarding"), { timeout: 8_000 });
  }).toPass({ timeout: 40_000 });
}

/**
 * 在取筆名頁取一個唯一筆名；新帳號不該出現舊資料認領（若出現就按「不是我的，跳過」，絕不認領）。
 * 取完筆名會先到三題品味問卷：預設跳過（stayOnTaste 時停在問卷）。回傳使用的筆名。
 */
export async function completePenName(page: Page, options: { stayOnTaste?: boolean } = {}): Promise<string> {
  await expect(page).toHaveURL(/\/onboarding\/pen-name/);
  const penName = uniquePenName();
  await waitForHydration(page, 'input[name="penName"]');
  await page.getByRole("textbox", { name: "署名" }).fill(penName);
  await page.getByRole("button", { name: "就用這個" }).click();
  const settled = (url: URL) => !url.pathname.startsWith("/onboarding") || url.pathname.startsWith("/onboarding/taste");
  // 問卷頁第一次進 dev 要編譯：等到網址換過就好（commit），不等整頁 load
  await page.waitForURL(settled, { timeout: 15_000, waitUntil: "commit" }).catch(() => undefined);
  if (!settled(new URL(page.url()))) {
    const skip = page.getByRole("button", { name: "不是我的，跳過" });
    if (await skip.isVisible()) await skip.click();
    await page.waitForURL(settled, { timeout: 15_000, waitUntil: "commit" }).catch(() => undefined);
  }
  await expect(page).not.toHaveURL(/\/onboarding\/pen-name/, { timeout: 30_000 });
  if (!options.stayOnTaste && new URL(page.url()).pathname.startsWith("/onboarding/taste")) await skipTasteOnboarding(page);
  return penName;
}

/** 完整登入（不寄信，本地遠端都一樣）：開 admin 登入連結 → 取筆名，回傳筆名 */
export async function loginAsNewUser(page: Page, email: string, next = "/me"): Promise<string> {
  await followAdminLoginLink(page, email, next);
  return completePenName(page);
}
