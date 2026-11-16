/**
 * P3 回信：讀者寫信 → 作者在「我的 › 來信」看到未讀 → 刊登＋回覆 → 文章頁出現讀者來函；
 * 每人每篇一封；封鎖後寄不到；別人讀不到他人來信；匿名署名的文章不開放。
 * 真走 magic link 登入（三個 browser context 各一位使用者）；文章以 service role 寫在作者名下，結束時整批刪除。
 */

import type { Browser, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { BASE_URL } from "./fixtures/env";
import { patch, seedEpisode } from "./fixtures/p2-seed";
import { expect, test } from "./fixtures/test";

const LETTER = "讀到妳姊把冰箱剩的東西炒成一盤飯，我想起我媽也這樣。這週末我想回家。";
const REPLY = "那就回去吧。";

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 375, height: 812 }, locale: "zh-TW" });
  return context.newPage();
}

async function seedArticle(userId: string, title: string, byline: "pen_name" | "anonymous" = "pen_name"): Promise<string> {
  const slug = `p3l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const id = await seedEpisode(userId, {
    title,
    status: "done",
    publishedAt: new Date().toISOString(),
    shareSlug: slug,
    visibility: "public",
    blog: {},
  });
  if (byline === "anonymous") await patch("episodes", `id=eq.${id}`, { byline: "anonymous" });
  return slug;
}

async function postLetter(page: Page, slug: string, body: string): Promise<number> {
  return page.evaluate(
    async ([s, b]) => (await fetch("/api/letters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: s, body: b }) })).status,
    [slug, body] as const,
  );
}

async function writeLetter(page: Page, slug: string, text: string): Promise<void> {
  await page.goto(`/s/${slug}`);
  await waitForHydration(page, "#letter-to-author");
  await page.getByRole("textbox", { name: /寫給作者的信/ }).fill(text);
  await page.getByRole("button", { name: "寄出" }).click();
  await expect(page.getByRole("status").filter({ hasText: "寄出了。作者看到會決定要不要刊登。" })).toBeVisible();
}

test("讀者寫信 → 作者刊登並回覆 → 讀者來函；一人一封、別人讀不到、封鎖後寄不到", async ({ page, browser, accounts }) => {
  const authorEmail = accounts.newEmail("p3l-author");
  const authorName = await loginAsNewUser(page, authorEmail, "/me");
  const authorId = await accounts.userIdOf(authorEmail);
  const slug = await seedArticle(authorId, "海街日記之後");
  const secondSlug = await seedArticle(authorId, "散場的公車");
  const anonymousSlug = await seedArticle(authorId, "不署名的一篇", "anonymous");

  // 作者看自己的文章：沒有寫信框
  await page.goto(`/s/${slug}`);
  await expect(page.getByRole("heading", { name: "寫封信給作者" })).toHaveCount(0);

  // 未登入：登入引導，回到原頁
  const guest = await newPage(browser);
  await guest.goto(`/s/${slug}`);
  await expect(guest.getByRole("link", { name: "登入寫信 →" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(`/s/${slug}`)}`,
  );

  // 讀者寫信
  const reader = await newPage(browser);
  const readerEmail = accounts.newEmail("p3l-reader");
  const readerName = await loginAsNewUser(reader, readerEmail, `/s/${slug}`);
  await expect(reader).toHaveURL(new RegExp(`/s/${slug}$`));
  const writeSection = reader.getByRole("region", { name: "寫封信給作者" });
  await expect(writeSection.getByText(authorName)).toBeVisible();
  await writeLetter(reader, slug, LETTER);
  await expect(reader.getByText(new RegExp(`寄了一封信給${authorName}。`))).toBeVisible({ timeout: 5_000 });

  // 每人每篇一封：重新整理只剩一行；再寄被擋
  await reader.reload();
  await expect(reader.getByText(new RegExp(`寄了一封信給${authorName}。`))).toBeVisible();
  await expect(reader.locator("#letter-to-author")).toHaveCount(0);
  expect(await postLetter(reader, slug, "第二封")).toBe(409);
  // 匿名署名的文章不開放回信
  expect(await postLetter(reader, anonymousSlug, "寫給匿名")).toBe(404);
  await reader.goto(`/s/${anonymousSlug}`);
  await expect(reader.getByRole("heading", { name: "寫封信給作者" })).toHaveCount(0);

  // 作者：我的 › 來信有未讀點
  await page.goto("/me");
  await page.getByRole("link", { name: "來信，1 封未讀" }).click();
  await expect(page).toHaveURL(/\/me\/letters$/);
  await expect(page.getByRole("heading", { name: "1 封信，還沒拆。" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`${readerName}\\s*，未讀`) }).click();
  await expect(page).toHaveURL(/\/me\/letters\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "來信" })).toBeVisible();
  await expect(page.getByText(LETTER)).toBeVisible();
  const [letter] = await rest<{ id: string; read_at: string | null }>("letters", `select=id,read_at&author_id=eq.${authorId}`);
  expect(letter.read_at).not.toBeNull();

  // 刊登＋回覆
  await waitForHydration(page, "#letter-reply");
  await page.getByRole("button", { name: "刊登在文章末尾" }).click();
  await expect(page.getByText("已刊登在文章末尾")).toBeVisible();
  await page.getByRole("textbox", { name: "回一句" }).fill(REPLY);
  await page.getByRole("button", { name: "送出" }).click();
  await expect(page.getByText("你的回覆")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "回一句" })).toHaveCount(0);

  await page.goto("/me");
  await expect(page.getByRole("link", { name: "來信", exact: true })).toBeVisible();

  // 文章頁出現讀者來函（含作者回覆）
  await guest.goto(`/s/${slug}`);
  const letters = guest.getByRole("region", { name: "讀者來函" });
  await expect(letters.getByText(readerName, { exact: true })).toBeVisible();
  await expect(letters.getByText(LETTER)).toBeVisible();
  await expect(letters.getByText(REPLY)).toBeVisible();
  await expect(letters.getByText("作者選刊・1 封")).toBeVisible();

  // 別人讀不到、改不了他人來信
  const stranger = await newPage(browser);
  await loginAsNewUser(stranger, accounts.newEmail("p3l-stranger"), "/me/letters");
  await expect(stranger.getByRole("heading", { name: "還沒有人來信。" })).toBeVisible();
  const strangerPatch = await stranger.evaluate(
    async (id) => (await fetch(`/api/letters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unpublish" }) })).status,
    letter.id,
  );
  expect(strangerPatch).toBe(404);
  const strangerView = await stranger.goto(`/me/letters/${letter.id}`);
  expect(strangerView?.status()).toBe(404);
  expect(await guest.evaluate(async () => (await fetch("/api/letters", { method: "POST", body: "{}" })).status)).toBe(401);

  // 封鎖：已刊登的撤下；之後寄到這位作者別篇也不會出現（寄信人照樣看到「寄出了」）
  await page.goto(`/me/letters/${letter.id}`);
  await waitForHydration(page, "#letter-reply, button");
  await page.getByRole("button", { name: "封鎖這位寄信人" }).click();
  await page.getByRole("button", { name: "確定封鎖" }).click();
  await expect(page.getByText(`已封鎖${readerName}`)).toBeVisible();
  await expect(page.getByText("只放在這裡", { exact: true })).toBeVisible();

  await guest.goto(`/s/${slug}`);
  await expect(guest.getByRole("region", { name: "讀者來函" })).toHaveCount(0);

  await writeLetter(reader, secondSlug, "封鎖之後的第二篇");
  const suppressed = await rest<{ suppressed: boolean }>("letters", `select=suppressed&author_id=eq.${authorId}&body=eq.${encodeURIComponent("封鎖之後的第二篇")}`);
  expect(suppressed).toEqual([{ suppressed: true }]);
  await page.goto("/me/letters");
  await expect(page.getByRole("heading", { name: "1 封信，讀過了。" })).toBeVisible();
  await expect(page.getByText("封鎖之後的第二篇")).toHaveCount(0);

  await Promise.all([guest, reader, stranger].map((p) => p.context().close()));
});
