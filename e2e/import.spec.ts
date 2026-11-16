/**
 * 部落格文章匯入（10/14）：貼網址 → 確認卡 → 選作品 → 勾「這是我寫的文章」→ 發佈 → 文章頁有「原文刊於」；再貼一次顯示已搬過。
 * 不打真的外部網站：
 * - 網頁與 LLM 回覆：dev server 帶 IMPORT_E2E_FIXTURES=e2e/fixtures/import（非 production 才生效），
 *   https://blog.example.com/2015/04/master 讀 fixture 的 master.html／master.llm.txt
 * - 作品候選：攔截瀏覽器的 /api/works/search 回固定結果；選定的作品事先寫進 works（不用打 TMDB 取詳情）
 * 只跑本檔：
 *   IMPORT_E2E_FIXTURES=e2e/fixtures/import npx next dev -p 3062 -H 127.0.0.1（另開）
 *   E2E_PORT=3062 E2E_EMAIL_PREFIX=e2e+import- npx playwright test e2e/import.spec.ts --config <不含 globalSetup 的設定>
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { expect, test } from "./fixtures/test";

const SHOTS = "design/import-preview";
const ARTICLE_URL = "https://blog.example.com/2015/04/master/?utm_source=facebook";
const STORED_URL = "https://blog.example.com/2015/04/master";
const TITLE = "《師父》：規矩森嚴的武林";

interface SeededWork {
  id: string;
  slug: string;
  tmdbId: number;
}

async function seedMovie(title: string, year: number): Promise<SeededWork> {
  const tmdbId = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const slug = `e2e-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/works`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ kind: "movie", title, year, region: "中國大陸", tmdb_id: tmdbId, slug }),
  });
  if (!response.ok) throw new Error(`[import seed] works → ${response.status} ${(await response.text()).slice(0, 200)}`);
  const [row] = (await response.json()) as Array<{ id: string; slug: string }>;
  return { ...row, tmdbId };
}

function screenResult(tmdbId: number, title: string, year: number) {
  return { kind: "movie", tmdbId, title, originalTitle: null, year, region: null, posterUrl: null, releaseDate: null, feelingCount: 0 };
}

/** 候選搜尋回兩部同名（1994 排在前面），驗證年份排序把 2015 排到第一 */
async function stubSearch(page: Page, correct: SeededWork, decoyTmdbId: number): Promise<void> {
  await page.route("**/api/works/search**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { kind: "movie", query: "師父", results: [screenResult(decoyTmdbId, "師父", 1994), screenResult(correct.tmdbId, "師父", 2015)] },
      },
    }),
  );
}

async function pasteAndRead(page: Page, url: string): Promise<void> {
  await page.getByRole("textbox", { name: /文章網址/ }).fill(url);
  await page.getByRole("button", { name: "讀取文章" }).click();
}

test("貼網址 → 選作品 → 勾選 → 發佈 → 文章頁有原文刊於；再貼一次已搬過", async ({ page, accounts }) => {
  const work = await seedMovie("師父", 2015);
  accounts.trackWork(work.id);
  const email = accounts.newEmail("flow");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  await stubSearch(page, work, work.tmdbId + 1);

  await page.getByRole("link", { name: /搬進舊文章/ }).click();
  await expect(page).toHaveURL(/\/me\/import$/);
  await waitForHydration(page, "main");
  await page.screenshot({ path: `${SHOTS}-empty.png`, fullPage: true });

  await pasteAndRead(page, ARTICLE_URL);
  const card = page.getByRole("article", { name: TITLE });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("blog.example.com・原文 2015.04.02");
  await expect(card).toContainText("徐浩峰的武林");
  await expect(card).toContainText("看起來在談《師父》（2015）");
  const choices = card.getByRole("group", { name: "這篇在談哪一部" }).getByRole("button", { name: /師父/ });
  await expect(choices.first()).toContainText("2015");
  const submit = card.getByRole("button", { name: "搬進來並發佈" });
  await expect(submit).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}-card.png`, fullPage: true });

  await choices.first().click();
  await expect(card).toContainText("已選定");
  await expect(submit).toBeDisabled(); // 還沒勾「這是我寫的文章」
  await card.getByRole("checkbox", { name: "這是我寫的文章" }).check();
  await expect(submit).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}-ready.png`, fullPage: true });
  await submit.click();

  const done = page.getByRole("link", { name: `看〈${TITLE}〉 →` });
  await expect(done).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${SHOTS}-done.png`, fullPage: true });

  const [episode] = await rest<Record<string, string | null>>(
    "episodes",
    `select=id,share_slug,original_url,published_at,visibility,byline,work_id,source&user_id=eq.${userId}`,
  );
  expect(episode).toMatchObject({ original_url: STORED_URL, visibility: "public", byline: "pen_name", work_id: work.id, source: "text" });
  expect(new Date(episode.published_at as string).toISOString()).toBe("2015-04-02T02:30:00.000Z");

  await done.click();
  await expect(page).toHaveURL(new RegExp(`/s/${episode.share_slug}$`));
  const origin = page.getByRole("link", { name: "〈blog.example.com〉" });
  await expect(origin).toHaveAttribute("href", STORED_URL);
  await expect(page.getByText("原文刊於")).toBeVisible();
  await expect(page.getByText("本文由作者口述")).toHaveCount(0);
  await origin.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}-article.png` });

  await page.goto("/me/import");
  await waitForHydration(page, "main");
  await pasteAndRead(page, "https://blog.example.com/2015/04/master#comments");
  await expect(page.getByText("已經搬過了。")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: `看〈${TITLE}〉 →` })).toHaveAttribute("href", `/s/${episode.share_slug}`);
  await page.screenshot({ path: `${SHOTS}-duplicate.png`, fullPage: true });
  expect(await rest("episodes", `select=id&user_id=eq.${userId}`)).toHaveLength(1);
});

test("抽不到正文顯示明確錯誤；未登入打 API 回 401；沒勾選 API 回 400", async ({ page, accounts, request }) => {
  const anonymous = await request.post("/api/import/preview", { data: { url: ARTICLE_URL } });
  expect(anonymous.status()).toBe(401);

  const email = accounts.newEmail("errors");
  await loginAsNewUser(page, email, "/me/import");
  await waitForHydration(page, "main");
  await pasteAndRead(page, "https://blog.example.com/");
  await expect(page.locator("main").getByRole("alert")).toHaveText("這個網址抓不到正文，請貼單篇文章的網址", { timeout: 30_000 });
  await page.screenshot({ path: `${SHOTS}-error.png`, fullPage: true });

  const unconfirmed = await page.request.post("/api/import", { data: { url: ARTICLE_URL, workId: crypto.randomUUID(), confirmed: false } });
  expect(unconfirmed.status()).toBe(400);
  expect((await unconfirmed.json()).error).toBe("請勾選「這是我寫的文章」");
});
