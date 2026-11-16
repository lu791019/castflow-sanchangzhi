/**
 * 寬螢幕版型（wide，Q-60）：1440 寬登入後看散場之前、目錄、一篇文章頁的寬版關鍵區塊，容器寬 > 1200；
 * 375 寬同三頁容器寬度不變（版面照手機）。散場之前「全部」依欄數藏多的卡（1440 四欄最多 16、手機 12）。
 * 假資料：TMDB（fixtures/tmdb-mock.ts）＋文化部／Apple 榜（fixtures/culture/mock-server.ts）。dev server 要帶：
 *   TMDB_API_BASE=http://127.0.0.1:<E2E_TMDB_MOCK_PORT>/3
 *   CULTURE_API_BASE=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/culture CULTURE_CACHE_TTL_MS=0
 *   APPLE_TOP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/top.json ITUNES_LOOKUP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/lookup
 * WIDE_SHOTS=1 時輸出 375／1024／1440／1920 寬整頁截圖到 design/wide-preview-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { makePng } from "./fixtures/covers-seed";
import { startCultureMock, type CultureMock } from "./fixtures/culture/mock-server";
import { patch } from "./fixtures/p2-seed";
import { expect, test } from "./fixtures/test";
import { startTmdbMock, type TmdbMock } from "./fixtures/tmdb-mock";
import { createArticle, createAuthor, createWorkWithSlug } from "./fixtures/uxread-seed";

const SHOTS = process.env.WIDE_SHOTS === "1";
const RUN = Date.now().toString(36).slice(-5);
const POSTER = makePng(500, 750, [180, 71, 27], [20, 18, 16]);
const MOBILE = { width: 375, height: 812 };
const WIDE = { width: 1440, height: 900 };

test.use({ hasTouch: true });

let tmdb: TmdbMock;
let culture: CultureMock;

test.beforeAll(async () => {
  tmdb = await startTmdbMock();
  culture = await startCultureMock(RUN);
});

test.afterAll(async () => {
  await Promise.all([tmdb?.close(), culture?.close()]);
});

/** 正文夠長才看得到寬版分欄 */
const BODY = [
  "燈亮的時候我沒有馬上站起來，看著片尾名單一行一行往上走，想把剛剛那兩個小時再放一次。",
  "三位導演各拍一位賊王，剪在一起卻毫無縫隙。觀影過程中完全不會有銜接不順暢和突兀的情況，整部片的劇情就在三位新生代導演的催生下，讓三位大賊踏上各自的命運征途。",
  "本片改編真實的香港三大賊王，轟動一時並銷聲匿跡。以綁架富豪之子為樂的那一位，由江湖謠言而興起了新的念頭，決定集合他們三位來創下新的犯罪巔峰。",
  "## 小人物",
  "看完最留下來的，是「小人物」三個字。每一個人都以為自己在推動什麼，其實只是被時代推著走。",
  "散場後走到街上，路口的燈號一直在倒數，我想起片裡那幾個沒有說完的對話，覺得很像我們每天在做的事。",
  "或許人們只是歷史齒輪轉動下的小人物，但小人物也有自己的選擇，這部片把這件事拍得很誠實。",
].join("\n\n");

async function seedArticle(accounts: { newEmail: (tag: string) => string; trackWork: (id: string) => void }): Promise<{ slug: string; title: string }> {
  const workTitle = `寬版測試片${RUN}`;
  const work = await createWorkWithSlug({ kind: "movie", title: workTitle, posterUrl: `https://image.tmdb.org/t/p/w500/wide-poster-${RUN}.jpg` });
  accounts.trackWork(work.id);
  const author = await createAuthor(accounts.newEmail("author"), `寬版作者${RUN}`);
  const title = `看完${workTitle}`;
  const slug = await createArticle(author, { title, workId: work.id });
  if (!slug) throw new Error("[wide] 文章沒有 share slug");
  const [episode] = await rest<{ id: string }>("episodes", `select=id&share_slug=eq.${slug}`);
  await patch("contents", `episode_id=eq.${episode.id}`, { body: `# ${title}\n\n${BODY}` });
  return { slug, title };
}

async function routePoster(page: Page): Promise<void> {
  await page.route(`**/wide-poster-*`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: POSTER }));
}

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("[wide] 量不到寬度（元素不可見）");
  return Math.round(box.width);
}

async function visibleCount(locator: Locator): Promise<number> {
  return locator.evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).length);
}

async function shot(page: Page, name: string, width: number): Promise<void> {
  if (!SHOTS) return;
  const viewport = page.viewportSize();
  // 整頁截圖用「把視窗撐到內容高」：fullPage 在殼的 transform 底下會漏畫視窗外的卡片
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(600);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.min(height, 6000) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `design/wide-preview-${name}-${width}.png` });
  if (viewport) await page.setViewportSize(viewport);
}

test("寬螢幕：散場之前、目錄、文章頁在 1440 用寬版（容器 > 1200），375 版面不變", async ({ page, accounts }) => {
  const article = await seedArticle(accounts);
  await routePoster(page);
  const email = accounts.newEmail("reader");
  await loginAsNewUser(page, email, "/before");

  const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
  const cards = thisWeek.locator("article");

  await test.step("散場之前 375：容器照手機（左右 16）、「全部」最多 12 張", async () => {
    await page.setViewportSize(MOBILE);
    await page.goto("/before");
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    expect(await widthOf(page.getByRole("heading", { level: 1 }))).toBe(MOBILE.width - 32);
    const rendered = await cards.count();
    expect(await visibleCount(cards)).toBe(Math.min(rendered, 12));
    await shot(page, "before", 375);
  });

  await test.step("散場之前 1440：容器 1360、卡片四欄最多 16 張、邊欄 400、分類鈕 aria-pressed", async () => {
    await page.setViewportSize(WIDE);
    await page.goto("/before");
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    const heading = page.getByRole("heading", { level: 1 });
    expect(await widthOf(heading.locator(".."))).toBeGreaterThan(1200);
    const grid = cards.first().locator("..");
    const columns = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(4);
    const rendered = await cards.count();
    expect(await visibleCount(cards)).toBe(Math.min(rendered, 16));
    expect(await widthOf(page.getByRole("region", { name: "你排好的" }))).toBe(400);
    const tabs = page.getByRole("group", { name: "分類" });
    await expect(tabs.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    // 刊頭：細刊頭列仍有索引、說一段
    const masthead = page.getByRole("banner").filter({ has: page.getByRole("link", { name: "說一段" }) });
    await expect(masthead.getByRole("link", { name: "索引" })).toBeVisible();
    await shot(page, "before", 1440);
    await shot(page, "before", 1920);
    await shot(page, "before", 1024);
  });

  await test.step("目錄 1440：大刊名、封面故事、本期目次、今晚的一句、這週被說起的（索引），觸控點分類", async () => {
    await page.goto("/?tab=all");
    await expect(page.getByRole("heading", { level: 1, name: "散場誌" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "分類" });
    expect(await widthOf(nav)).toBeGreaterThan(1200);
    await expect(nav.getByRole("link", { name: "全部", exact: true })).toHaveAttribute("aria-current", "page");
    for (const label of ["影劇", "Podcast", "音樂", "演出", "展覽", "隨筆"]) {
      const box = await nav.getByRole("link", { name: label, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const cover = page.getByRole("region", { name: "本期焦點" });
    await expect(cover).toBeVisible();
    expect(await widthOf(cover)).toBeGreaterThan(1200);
    await expect(cover.getByRole("link", { name: /^讀全文：/ })).toBeVisible();
    const contents = page.getByRole("region", { name: "本期目次" });
    await expect(contents.getByRole("link", { name: new RegExp(article.title) })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "索引" }).getByText("這週被說起的")).toBeVisible();
    // 窄版目錄流在寬版藏起來：標題只在目次（h3）一次，是頭條的話封面故事（h2）再一次
    const isLead = (await cover.getByRole("heading", { level: 2, name: article.title, exact: true }).count()) === 1;
    await expect(page.getByRole("heading", { name: article.title, exact: true })).toHaveCount(isLead ? 2 : 1);
    await shot(page, "feed", 1440);
    await shot(page, "feed", 1920);
    await shot(page, "feed", 1024);

    await waitForHydration(page, 'button[aria-label="記一筆"]');
    await nav.getByRole("link", { name: "影劇", exact: true }).tap();
    await page.waitForURL(/\?tab=screen/);
    await expect(page.getByRole("navigation", { name: "分類" }).getByRole("link", { name: "影劇", exact: true })).toHaveAttribute("aria-current", "page");
  });

  await test.step("目錄 375：照手機（分類列寬 343），沒有寬版區塊", async () => {
    await page.setViewportSize(MOBILE);
    await page.goto("/?tab=all");
    expect(await widthOf(page.getByRole("navigation", { name: "分類" }))).toBe(MOBILE.width - 32);
    await expect(page.getByRole("region", { name: "本期目次" })).toHaveCount(0);
    await shot(page, "feed", 375);
  });

  await test.step("文章頁 1440：跨頁（海報＋大標）、正文多欄、資訊欄看作品特輯", async () => {
    await page.setViewportSize(WIDE);
    await page.goto(`/s/${article.slug}`);
    const h1 = page.getByRole("heading", { level: 1, name: article.title });
    await expect(h1).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("img", { name: `《寬版測試片${RUN}》海報` })).toBeVisible();
    const main = page.getByRole("main");
    expect(await widthOf(main)).toBeGreaterThan(1200);
    // 多欄在正文裡的每一組欄上（長文限欄高，見 polish5.spec）
    const body = page.locator("article").filter({ hasText: "三位導演各拍一位賊王" }).locator("[data-column-group]").first();
    expect(await body.evaluate((node) => getComputedStyle(node).columnWidth)).toBe("340px");
    await expect(page.getByRole("link", { name: "看作品特輯 →" })).toBeVisible();
    await shot(page, "article", 1440);
    await shot(page, "article", 1920);
    await shot(page, "article", 1024);
  });

  await test.step("文章頁 375：單欄（main 寬 375）、跨頁不出現、作品卡還在", async () => {
    await page.setViewportSize(MOBILE);
    await page.goto(`/s/${article.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: article.title })).toBeVisible({ timeout: 20_000 });
    expect(await widthOf(page.getByRole("main"))).toBe(MOBILE.width);
    await expect(page.getByRole("img", { name: `《寬版測試片${RUN}》海報` })).toHaveCount(1);
    await expect(page.getByRole("link", { name: `《寬版測試片${RUN}》作品特輯` })).toBeVisible();
    await shot(page, "article", 375);
  });
});
