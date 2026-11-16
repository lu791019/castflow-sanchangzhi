/**
 * 音樂作品類別＋目錄／索引全類別（music，Q-61）：
 * 1. 作品選擇器「音樂」分頁搜「告五人」選專輯 → 記一筆（在家）→ 日誌看得到「音樂・在家」→ 作品特輯 1:1 封面、在哪聽
 * 2. 散場之前「音樂」分頁：本週熱門專輯卡 → 排進行程預選該專輯（在家、選日期時間）
 * 3. 目錄依作品類別分：影劇／Podcast／音樂／演出／展覽／隨筆各一篇種子文章在對的分頁；舊 tab=screen 照用；索引音樂書架
 * 假資料：iTunes／Apple Music 榜／Podcast 榜／文化部（fixtures/music/mock-server.ts）＋TMDB（fixtures/tmdb-mock.ts）。dev server 要帶：
 *   TMDB_API_BASE=http://127.0.0.1:<E2E_TMDB_MOCK_PORT>/3
 *   ITUNES_SEARCH_URL=…/itunes/search ITUNES_LOOKUP_URL=…/itunes/lookup APPLE_MUSIC_TOP_URL=…/music/top.json
 *   APPLE_TOP_URL=…/apple/top.json CULTURE_API_BASE=…/culture CULTURE_CACHE_TTL_MS=0（皆 http://127.0.0.1:<E2E_MUSIC_MOCK_PORT>）
 * MUSIC_SHOTS=1 時輸出 375／1280 寬截圖到 design/music-preview-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { loginAsNewUser, uniquePenName, waitForHydration } from "./fixtures/auth";
import { createArticle, createAuthor, createKindWork, musicWorkId, type SeedKind } from "./fixtures/music-seed";
import { SEARCH_ALBUMS, startMusicMock, TOP_ALBUMS, type MusicMock } from "./fixtures/music/mock-server";
import { expect, test, type Accounts } from "./fixtures/test";
import { startTmdbMock, type TmdbMock } from "./fixtures/tmdb-mock";

const SHOTS = process.env.MUSIC_SHOTS === "1";

test.use({ hasTouch: true });

let tmdb: TmdbMock;
let mock: MusicMock;

test.beforeAll(async () => {
  [tmdb, mock] = await Promise.all([startTmdbMock(), startMusicMock()]);
});

test.afterAll(async () => {
  await Promise.all([tmdb?.close(), mock?.close()]);
});

async function shot(page: Page, name: string, width?: number): Promise<void> {
  if (!SHOTS) return;
  const viewport = page.viewportSize();
  if (!viewport) return;
  const target = width ?? viewport.width;
  await page.setViewportSize({ width: target, height: viewport.height });
  await page.waitForTimeout(400);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: target, height: Math.min(Math.max(height, viewport.height), 4000) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `design/music-preview-${name}.png` });
  await page.setViewportSize(viewport);
}

async function expectSquare(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box?.width ?? 0) - (box?.height ?? 1))).toBeLessThanOrEqual(1);
}

/** 第一次用介面記下會先帶去權限引導：按「先不用」回來 */
async function skipPermissionPrompt(page: Page): Promise<void> {
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 5_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/notifications"), { timeout: 30_000 });
  }
}

async function trackMusicWorks(accounts: Accounts, ids: number[]): Promise<void> {
  for (const id of ids) {
    const workId = await musicWorkId(id);
    if (workId) accounts.trackWork(workId);
  }
}

test("音樂：選擇器搜專輯 → 記一筆 → 日誌、作品特輯 1:1；散場之前音樂分頁排進行程", async ({ page, accounts }) => {
  const album = SEARCH_ALBUMS[0];
  const albumTitle = "散場測試・帶你飛";
  const top = TOP_ALBUMS[0];
  const topTitle = "散場測試・夜車";
  const email = accounts.newEmail("pick");
  await loginAsNewUser(page, email, "/journal");

  try {
    await test.step("記一筆 → 搜尋作品 → 音樂分頁：本週熱門有專輯；搜「告五人」→ 選專輯", async () => {
      await page.goto("/journal");
      await waitForHydration(page, 'button[aria-label="記一筆"]');
      await page.getByRole("button", { name: "記一筆", exact: true }).tap();
      const sheet = page.getByRole("dialog", { name: "記一筆" });
      await sheet.getByRole("button", { name: "搜尋作品" }).tap();
      const picker = page.getByRole("dialog", { name: /這篇在說哪一部？|選擇作品/ });
      await picker.getByRole("navigation", { name: "類型" }).getByRole("button", { name: "音樂" }).tap();
      await expect(picker.getByRole("region", { name: "本週熱門" }).getByRole("button", { name: new RegExp(topTitle) })).toBeVisible({ timeout: 20_000 });
      await expect(picker.getByText("音樂資料來源：Apple Music")).toBeVisible();
      await shot(page, "picker-trending");

      await picker.getByRole("searchbox", { name: "搜尋作品" }).fill("告五人");
      const row = picker.getByRole("button", { name: new RegExp(`${albumTitle}.*告五人・2023・10 首`) });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(picker.getByRole("button", { name: /散場測試・披星戴月的想你.*單曲/ })).toBeVisible();
      await shot(page, "picker-search");
      await row.tap();
      await expect(picker).toBeHidden({ timeout: 20_000 });

      await expect(sheet.getByRole("radio", { name: new RegExp(albumTitle) })).toHaveAttribute("aria-checked", "true");
      await sheet.getByRole("radio", { name: "在家" }).tap();
      await shot(page, "log-sheet");
      await sheet.getByRole("button", { name: "記下了" }).tap();
      await expect(page.getByText("散場誌・日誌")).toBeVisible();
      await skipPermissionPrompt(page);
    });

    await test.step("日誌看得到這張專輯（音樂・在家）", async () => {
      await page.goto("/journal");
      await expect(page.getByText(albumTitle).first()).toBeVisible();
      await expect(page.getByText("音樂・在家").first()).toBeVisible();
      await shot(page, "journal");
    });

    await test.step("作品特輯：1:1 專輯封面、音樂・meta、在哪聽（Apple Music 直連＋搜尋）", async () => {
      await page.goto(`/works/music-${album.id}`);
      const cover = page.getByRole("img", { name: `《${albumTitle}》專輯封面` });
      await expect(cover).toBeVisible();
      await expectSquare(cover);
      await expect(page.getByText("2023 · 告五人")).toBeVisible();
      await expect(page.getByText("圖|《散場測試・帶你飛》專輯封面 · Apple Music")).toBeVisible();
      const listen = page.getByRole("navigation", { name: "收聽平台" });
      await expect(listen.getByRole("link", { name: /Apple Music/ })).toHaveAttribute("href", `https://music.apple.com/tw/album/${album.id}`);
      await expect(listen.getByRole("link", { name: /KKBOX/ })).toHaveAttribute(
        "href",
        `https://www.kkbox.com/tw/tc/search?q=${encodeURIComponent(`${albumTitle} 告五人`)}`,
      );
      await shot(page, "work");
      await shot(page, "work-1280", 1280);
    });

    await test.step("散場之前：音樂分頁 → 本週熱門專輯卡 → 排進行程預選該專輯（在家、選日期時間）", async () => {
      await page.goto("/before");
      const tabs = page.getByRole("group", { name: "分類" });
      await waitForHydration(page, 'div[aria-label="分類"] button');
      await tabs.getByRole("button", { name: "音樂", exact: true }).tap();
      await expect(tabs.getByRole("button", { name: "音樂", exact: true })).toHaveAttribute("aria-pressed", "true");
      const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
      const card = thisWeek.getByRole("article").filter({ has: page.getByRole("heading", { name: topTitle, exact: true }) });
      await expect(card.getByText("音樂・本週熱門")).toBeVisible();
      await expect(card.getByRole("link", { name: `去聽：${topTitle}（另開視窗）` })).toHaveAttribute(
        "href",
        `https://music.apple.com/tw/album/${top.id}`,
      );
      await expect(thisWeek.getByText("電影・正在上映")).toHaveCount(0);
      await shot(page, "before-music");
      await shot(page, "before-music-1280", 1280);

      await card.getByRole("button", { name: `排進行程：${topTitle}` }).tap();
      const sheet = page.getByRole("dialog", { name: "記一筆" });
      await expect(sheet).toBeVisible({ timeout: 20_000 });
      await expect(sheet.getByRole("radio", { name: new RegExp(topTitle) })).toHaveAttribute("aria-checked", "true");
      await expect(sheet.getByRole("radio", { name: "在家" })).toHaveAttribute("aria-checked", "true");
      await expect(sheet.getByRole("radio", { name: "選日期時間" })).toHaveAttribute("aria-checked", "true");
      await shot(page, "before-sheet");
      await sheet.getByRole("button", { name: "關閉" }).click();
      await expect(sheet).toBeHidden();
    });
  } finally {
    await trackMusicWorks(accounts, [album.id, top.id]);
  }
});

const SEEDS: ReadonlyArray<{ tab: string; label: string; kind: SeedKind | null }> = [
  { tab: "screen", label: "影劇", kind: "movie" },
  { tab: "podcast", label: "Podcast", kind: "podcast_episode" },
  { tab: "music", label: "音樂", kind: "music" },
  { tab: "live", label: "演出", kind: "live" },
  { tab: "exhibition", label: "展覽", kind: "exhibition" },
  { tab: "essay", label: "隨筆", kind: null },
];

test("目錄依作品類別分頁（各類一篇種子文章在對的分頁）；舊 tab=screen 照用；索引音樂書架", async ({ page, accounts }) => {
  const run = Date.now().toString(36).slice(-5);
  const authorId = await createAuthor(accounts.newEmail("author"), uniquePenName());
  const articles: Array<{ tab: string; label: string; title: string; workTitle: string | null }> = [];
  for (const [index, seed] of SEEDS.entries()) {
    const workTitle = seed.kind ? `全類別${seed.label}作品 ${run}` : null;
    const work = seed.kind && workTitle ? await createKindWork(seed.kind, workTitle) : null;
    if (work) accounts.trackWork(work.id);
    const title = `全類別測試・${seed.label}的一篇 ${run}`;
    await createArticle(authorId, { title, workId: work?.id ?? null, publishedAt: new Date(Date.now() - index * 60_000).toISOString() });
    articles.push({ tab: seed.tab, label: seed.label, title, workTitle });
  }
  const email = accounts.newEmail("feed");
  await loginAsNewUser(page, email, "/?tab=all");
  const titles = page.getByRole("heading", { level: 2 });

  await test.step("全部：六篇都在；分類列有全部／影劇／Podcast／音樂／演出／展覽／隨筆", async () => {
    await page.goto("/?tab=all");
    const nav = page.getByRole("navigation", { name: "分類" });
    // 換頁進場動畫（位移／縮放）跑完才量高度：動畫中途量到 43.99998
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
    for (const label of ["全部", "影劇", "Podcast", "音樂", "演出", "展覽", "隨筆"]) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const article of articles) await expect(titles.filter({ hasText: article.title })).toHaveCount(1);
    await shot(page, "feed-all");
    await shot(page, "feed-all-1280", 1280);
  });

  for (const article of articles) {
    await test.step(`?tab=${article.tab}：只有${article.label}那篇`, async () => {
      await page.goto(`/?tab=${article.tab}`);
      const nav = page.getByRole("navigation", { name: "分類" });
      await expect(nav.getByRole("link", { name: article.label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(titles.filter({ hasText: article.title })).toHaveCount(1);
      for (const other of articles.filter((item) => item !== article)) await expect(titles.filter({ hasText: other.title })).toHaveCount(0);
    });
  }

  await test.step("觸控點分類（音樂）；舊網址 tab=screen 與別名 tab=movie 都對到影劇", async () => {
    await page.goto("/?tab=all");
    await page.getByRole("navigation", { name: "分類" }).getByRole("link", { name: "音樂", exact: true }).tap();
    await page.waitForURL(/\?tab=music/);
    await expect(titles.filter({ hasText: articles[2].title })).toHaveCount(1);
    await shot(page, "feed-music");
    const screen = articles[0];
    for (const legacy of ["screen", "movie"]) {
      await page.goto(`/?tab=${legacy}`);
      await expect(page.getByRole("navigation", { name: "分類" }).getByRole("link", { name: "影劇", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(titles.filter({ hasText: screen.title })).toHaveCount(1);
      await expect(titles.filter({ hasText: articles[1].title })).toHaveCount(0);
    }
  });

  await test.step("索引作品：依類別分組，音樂書架在 Podcast 之後、演出之前，音樂封面方形", async () => {
    await page.goto("/catalog");
    const headings = await page.locator('h2[id^="shelf-"]').allTextContents();
    const order = ["電影", "Podcast", "音樂", "演出", "展覽"].map((label) => headings.indexOf(label));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const shelf = page.getByRole("region", { name: "音樂" });
    const link = shelf.getByRole("link", { name: new RegExp(`全類別音樂作品 ${run}`) });
    await expect(link).toBeVisible();
    await expectSquare(link.getByRole("img").first());
    await shot(page, "catalog");
    await shot(page, "catalog-1280", 1280);
  });
});
