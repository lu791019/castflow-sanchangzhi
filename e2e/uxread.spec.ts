/**
 * 體驗盤點收尾 A 閱讀面（uxread，10/14）：
 * - 文章頁／特輯海報載入失敗（攔成 404）→ 退字卡，不留空框
 * - UX-09 特輯直排長片名每個字都看得到，不被海報後的色塊蓋住、不伸進海報
 * - UX-25 字卡英文字不切半、英文為主改橫排；補封面預覽載入失敗就收起
 * - UX-21 社交殼只有一個 main；訪客不打 /api/notifications/unread
 * - UX-20／UX-13 改筆名：自己現在的筆名停用；預覽印章與日誌頁頭同一套規則
 * - UX-19 觸控目標（含 ::before 擴大區）≥ 44×44
 * - UX-23 目錄卡署名：筆名或「匿名」，不再一律「作者」
 */

import type { Locator, Page } from "@playwright/test";
import { sealShape } from "../src/lib/seal/seal";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";
import { createArticle, createAuthor, createWorkWithSlug } from "./fixtures/uxread-seed";

test.use({ hasTouch: true, isMobile: true });

/** 1×1 PNG：讓「載入成功」的海報網址有圖可回 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const MISSING = "e2e-uxread-missing";
const OK = "e2e-uxread-ok";

function token(): string {
  return Date.now().toString(36).slice(-5);
}

async function routeImages(page: Page): Promise<void> {
  await page.route(`**/${MISSING}-*`, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(`**/${OK}-*`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
}

/** 實際點擊區：元素本身與 ::before 擴大區取大 */
async function hitBox(locator: Locator): Promise<{ width: number; height: number }> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const before = getComputedStyle(element, "::before");
    const expanded = before.content !== "none" && before.position === "absolute";
    return {
      width: Math.max(rect.width, expanded ? parseFloat(before.width) || 0 : 0),
      height: Math.max(rect.height, expanded ? parseFloat(before.height) || 0 : 0),
    };
  });
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await hitBox(locator);
  expect(box.width, "點擊區寬").toBeGreaterThanOrEqual(44);
  expect(box.height, "點擊區高").toBeGreaterThanOrEqual(44);
}

/** 標題每個字的中心點，最上層元素都是標題本身（沒有被色塊、海報蓋住） */
async function coveredChars(title: Locator): Promise<string[]> {
  return title.evaluate((element) => {
    const text = element.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) return ["(沒有文字)"];
    const content = text.textContent ?? "";
    const range = document.createRange();
    return Array.from(content).flatMap((char, index) => {
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const rect = range.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit && element.contains(hit) ? [] : [char];
    });
  });
}

test("海報載入失敗：文章頁作品卡退字卡、特輯退字卡封面，不留空框", async ({ page, accounts }) => {
  const tok = token();
  await routeImages(page);
  const title = `退路${tok}`;
  const work = await createWorkWithSlug({ kind: "movie", title, posterUrl: `https://image.tmdb.org/t/p/w500/${MISSING}-${tok}.jpg` });
  accounts.trackWork(work.id);
  const penName = `讀者${tok}`;
  const author = await createAuthor(accounts.newEmail("poster"), penName);
  const slug = await createArticle(author, { title: `看完${title}`, workId: work.id });
  await createArticle(author, { title: `不署名的一篇${tok}`, workId: work.id, byline: "anonymous" });

  // UX-23 目錄卡署名：筆名署名寫筆名、匿名寫「匿名」，不再一律「作者」，匿名那篇不露筆名
  await page.goto("/");
  const signed = page.getByRole("link", { name: new RegExp(`看完${title}`) }).first();
  await expect(signed).toContainText(`《${title}》 — ${penName}`, { timeout: 20_000 });
  const anonymous = page.getByRole("link", { name: new RegExp(`不署名的一篇${tok}`) }).first();
  await expect(anonymous).toContainText(`《${title}》 — 匿名`);
  await expect(anonymous).not.toContainText(penName);
  await page.screenshot({ path: "design/uxread-preview-feed-byline.png" });

  await page.goto(`/s/${slug}`);
  const plate = page.getByTestId("work-card-plate");
  await expect(plate).toBeVisible({ timeout: 20_000 });
  await expect(plate).toContainText(title);
  await expect(page.getByRole("img", { name: `《${title}》海報` })).toHaveCount(0);
  await expectTouchTarget(page.getByRole("link", { name: "散場誌", exact: true }).first());
  // UX-13：署名改用筆名印章（不再是灰色圓形頭像）
  await expect(page.locator(`[data-seal-shape="${sealShape(penName)}"]`).first()).toBeVisible();
  await plate.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "design/uxread-preview-article-poster-fallback.png" });

  await page.goto(`/works/${work.slug}`);
  await expect(page.locator('[data-cover="card"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("img", { name: `《${title}》海報` })).toHaveCount(0);
});

test("UX-09 特輯直排片名：四字、八字都完整可見，不伸進海報", async ({ page, accounts }) => {
  const tok = token();
  await routeImages(page);
  for (const [index, title] of ["樹大招風", "搬回家住的第一年"].entries()) {
    const work = await createWorkWithSlug({ kind: "movie", title, posterUrl: `https://image.tmdb.org/t/p/w500/${OK}-${tok}${index}.png` });
    accounts.trackWork(work.id);
    await page.goto(`/works/${work.slug}`);
    const heading = page.getByTestId("work-hero-title");
    await expect(heading).toHaveText(title, { timeout: 20_000 });
    const poster = page.getByRole("img", { name: `《${title}》海報` });
    await expect(poster).toBeVisible();
    await page.waitForTimeout(600); // 色塊淡入
    expect(await coveredChars(heading)).toEqual([]);
    const [headingBox, posterBox] = [await heading.boundingBox(), await poster.boundingBox()];
    expect(headingBox && posterBox && headingBox.x + headingBox.width <= posterBox.x).toBe(true);
    await page.screenshot({ path: `design/uxread-preview-works-title-${index + 1}.png` });
  }
});

test("UX-25 字卡英文字不切半、英文為主改橫排；UX-21 訪客只有一個 main、不查未讀；UX-19 觸控目標", async ({ page, accounts }) => {
  const tok = token();
  const unread: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/notifications/unread")) unread.push(request.url());
  });

  // 英文字＋中文：中文為主，直排；英文字整個留在同一欄
  const mixed = await createWorkWithSlug({ kind: "live", title: "uxread 測試演出", venue: "測試場館", eventDate: "2026-10-14" });
  const latin = await createWorkWithSlug({ kind: "live", title: `Night Lights ${tok}`, venue: "測試場館", eventDate: "2026-10-14" });
  accounts.trackWork(mixed.id);
  accounts.trackWork(latin.id);

  await page.goto(`/works/${mixed.slug}`);
  const card = page.locator('[data-cover="card"]').first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.locator("span", { hasText: /^uxread$/ })).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expectTouchTarget(page.getByRole("button", { name: "補封面" }));
  await page.screenshot({ path: "design/uxread-preview-cover-mixed.png" });

  await page.goto(`/works/${latin.slug}`);
  // 場刊字卡取分隔前那段（Night），英文字整個留著、橫排
  await expect(page.locator('[data-title-orientation="horizontal"]').first()).toHaveText("Night", { timeout: 20_000 });
  await page.waitForTimeout(500); // 換頁淡入
  await page.screenshot({ path: "design/uxread-preview-cover-latin.png" });

  await page.goto("/");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await expect(page.getByRole("main")).toHaveCount(1);
  for (const name of ["全部", "影劇"]) await expectTouchTarget(page.getByRole("link", { name, exact: true }).first());

  await page.goto("/catalog");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await expect(page.getByRole("main")).toHaveCount(1);
  const tabs = page.getByRole("navigation", { name: "索引分類" });
  for (const name of ["作品", "作者", "欄目"]) await expectTouchTarget(tabs.getByRole("link", { name, exact: true }));
  await expectTouchTarget(page.getByRole("link", { name: "散場誌", exact: true }).first());

  await page.waitForTimeout(1_500);
  expect(unread).toEqual([]);
});

test("UX-20／UX-13 改筆名：自己的筆名停用、預覽印章同一套規則；補封面預覽失敗就收起；登入後才查未讀", async ({ page, accounts }) => {
  const tok = token();
  await routeImages(page);
  const unread: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/notifications/unread")) unread.push(request.url());
  });
  const penName = await loginAsNewUser(page, accounts.newEmail("pen"), "/me");

  await page.goto("/onboarding/pen-name?next=%2Fme%2Fsettings");
  await waitForHydration(page, 'input[name="penName"]');
  const input = page.getByRole("textbox", { name: "署名" });
  await expect(input).toHaveValue(penName);
  await expect(page.getByRole("status").filter({ hasText: "這是你現在的筆名" })).toBeVisible();
  await expect(page.getByRole("button", { name: "這是你現在的筆名" })).toBeDisabled();
  await expect(page.locator("form [data-seal-shape]").first()).toHaveAttribute("data-seal-shape", String(sealShape(penName)));
  await page.screenshot({ path: "design/uxread-preview-pen-name-current.png" });

  const renamed = `${penName}乙`;
  await input.fill(renamed);
  await expect(page.getByRole("button", { name: "就用這個" })).toBeEnabled({ timeout: 45_000 });
  await expect(page.locator("form [data-seal-shape]").first()).toHaveAttribute("data-seal-shape", String(sealShape(renamed)));

  await page.goto("/journal");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator(`main [data-seal-shape="${sealShape(penName)}"]`).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "design/uxread-preview-journal-seal.png" });
  expect(unread.length).toBeGreaterThan(0);

  await page.goto("/me/settings");
  await expectTouchTarget(page.getByRole("radio", { name: "公開" }).first());

  const live = await createWorkWithSlug({ kind: "live", title: `補封面${tok}`, venue: "測試場館", eventDate: "2026-10-14" });
  accounts.trackWork(live.id);
  await page.goto(`/works/${live.slug}`);
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "補封面" }).tap();
  const url = page.getByRole("textbox", { name: "封面圖片網址" });
  await expectTouchTarget(page.getByRole("button", { name: "上傳", exact: true }));
  await url.fill(`https://example.com/${OK}-${tok}.png`);
  await expect(page.getByRole("img", { name: "封面預覽" })).toBeVisible();
  await url.fill(`https://example.com/${MISSING}-${tok}.png`);
  await expect(page.getByRole("img", { name: "封面預覽" })).toHaveCount(0);
  await page.screenshot({ path: "design/uxread-preview-cover-preview-hidden.png" });
});
