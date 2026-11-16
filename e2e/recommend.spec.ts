/**
 * 作品推薦（Q-40 C）：散場之前「你可能會想看」。
 * - 新帳號（沒寫過、沒記過、沒填問卷）整區不顯示
 * - 寫過一部（私人草稿也算）→ 出現推薦，理由引用那部作品 → 「排進行程」成功 → 排過的不再推
 * - 別人看不到你的推薦，也看不到你私人文章的作品名
 * TMDB 用假 server（e2e/fixtures/tmdb-mock.ts）：dev server 要帶 TMDB_API_BASE=http://127.0.0.1:3163/3 啟動。
 * RECOMMEND_SHOTS=1 時輸出 375 寬截圖到 design/recommend-preview-*.png。
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { expect, test } from "./fixtures/test";
import { HIT_MOVIE, OTHER_MOVIE, SEED_MOVIE, startTmdbMock, type TmdbMock } from "./fixtures/tmdb-mock";

const SHOTS = process.env.RECOMMEND_SHOTS === "1";
const DAY = 24 * 60 * 60 * 1000;
const REASON = `因為你寫過〈${SEED_MOVIE.title}〉`;

let mock: TmdbMock;

test.beforeAll(async () => {
  mock = await startTmdbMock();
});

test.afterAll(async () => {
  await mock.close();
});

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(350);
  const viewport = page.viewportSize();
  if (viewport) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `design/recommend-preview-${name}.png` });
  if (viewport) await page.setViewportSize(viewport);
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`[recommend seed] ${init.method} ${path} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response;
}

/** 種子作品（kind+tmdb_id 唯一）：上次中斷留下的就沿用 */
async function seedMovieWork(): Promise<string> {
  const existing = await rest<{ id: string }>("works", `select=id&kind=eq.movie&tmdb_id=eq.${SEED_MOVIE.id}`);
  if (existing[0]) return existing[0].id;
  const response = await call("/rest/v1/works", {
    method: "POST",
    body: JSON.stringify({ kind: "movie", title: SEED_MOVIE.title, tmdb_id: SEED_MOVIE.id, slug: `e2e-recommend-${Date.now().toString(36)}` }),
  });
  const [created] = (await response.json()) as Array<{ id: string }>;
  return created.id;
}

/** 私人、沒發佈的草稿：只有本人的推薦會用到 */
async function seedPrivateDraft(userId: string, workId: string): Promise<void> {
  const response = await call("/rest/v1/episodes", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, title: "只寫給自己的", source: "text", status: "transcribed", work_id: workId }),
  });
  const [episode] = (await response.json()) as Array<{ id: string }>;
  await call(`/rest/v1/episodes?id=eq.${episode.id}`, { method: "PATCH", body: JSON.stringify({ visibility: "private" }) });
}

function taipeiDay(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test("寫過一部 → 你可能會想看（理由引用自己的作品）→ 排進行程；新帳號與別人看不到", async ({ page, browser, accounts }) => {
  const seedWorkId = await seedMovieWork();
  accounts.trackWork(seedWorkId);

  // 新帳號：沒有任何訊號，整區不顯示（goto 等到串流結束才回來）
  const email = accounts.newEmail("writer");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);
  await page.goto("/before");
  await expect(page.getByRole("region", { name: "有人說了" })).toBeVisible();
  await expect(page.getByRole("region", { name: "這週上映・開演・開展" }).getByText(HIT_MOVIE.title)).toBeVisible();
  await expect(page.getByTestId("recommend")).toHaveCount(0);

  // 寫過〈人聲〉（私人草稿）→ 推薦出現，理由引用那部
  await seedPrivateDraft(userId, seedWorkId);
  await page.goto("/before");
  const section = page.getByRole("region", { name: "你可能會想看" });
  await expect(section).toBeVisible();
  await expect(section.getByText("只有你看得到")).toBeVisible();
  const card = section.getByRole("article").filter({ hasText: HIT_MOVIE.title });
  await expect(card).toBeVisible();
  await expect(card.getByText(REASON)).toBeVisible();
  // 跟種子沒關係、也沒有品味訊號的不硬推
  await expect(section.getByText(OTHER_MOVIE.title)).toHaveCount(0);
  await expect(card.getByRole("link", { name: `${HIT_MOVIE.title}：訂票` })).toHaveAttribute("href", /google\.com\/search/);
  await section.scrollIntoViewIfNeeded();
  await shot(page, "filled");

  // 排進行程：開記一筆 sheet，預選作品、切到選日期時間
  const planName = `排進行程：${HIT_MOVIE.title}`;
  await waitForHydration(page, `[data-testid="recommend"] button[aria-label="${planName}"]`);
  await card.getByRole("button", { name: planName }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  // 先 POST /api/works 建作品（dev 第一次要編譯）才開 sheet
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  await expect(sheet.getByText(HIT_MOVIE.title).first()).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "選日期時間" })).toHaveAttribute("aria-checked", "true");
  const day = taipeiDay(new Date(Date.now() + 2 * DAY));
  await sheet.getByLabel("日期時間").fill(`${day}T19:30`);
  await shot(page, "sheet");
  await sheet.getByRole("button", { name: "排進行程" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 5_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/notifications"), { timeout: 30_000 });
  }

  // DB：計畫中，綁在 TMDB 那部
  const [hitWork] = await rest<{ id: string }>("works", `select=id&kind=eq.movie&tmdb_id=eq.${HIT_MOVIE.id}`);
  expect(hitWork).toBeTruthy();
  accounts.trackWork(hitWork.id);
  const entries = await rest<{ status: string; work_id: string }>("journal_entries", `select=status,work_id&user_id=eq.${userId}`);
  expect(entries).toEqual([{ status: "planned", work_id: hitWork.id }]);

  // 排過的不再推；「你排好的」出現
  await page.goto("/before");
  await expect(page.getByRole("region", { name: "你排好的" }).getByText(HIT_MOVIE.title)).toBeVisible();
  await expect(page.getByRole("region", { name: "你可能會想看" }).getByText(HIT_MOVIE.title)).toHaveCount(0);

  // 另一個新帳號：看不到這區，也看不到私人文章的作品名
  const otherContext = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "zh-TW" });
  try {
    const other = await otherContext.newPage();
    await loginAsNewUser(other, accounts.newEmail("other"), "/before");
    await other.goto("/before");
    await expect(other.getByRole("region", { name: "有人說了" })).toBeVisible();
    await expect(other.getByTestId("recommend")).toHaveCount(0);
    await expect(other.getByText(SEED_MOVIE.title)).toHaveCount(0);
    await shot(other, "new-account");
  } finally {
    await otherContext.close();
  }
});
