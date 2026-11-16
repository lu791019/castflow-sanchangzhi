/**
 * 散場之前補齊多類別（beforesrc）：電影、影集、Podcast 本週榜單、文化部演出（含音樂祭）與展覽同時出現；
 * 文化部掛掉時頁面照常、只少那區；分類切換（觸控）；Podcast 排進行程預選最新一集；演出排進行程 → 日誌「接下來」。
 * 假資料：TMDB（fixtures/tmdb-mock.ts）＋文化部／Apple 榜／RSS（fixtures/culture/mock-server.ts）。dev server 要帶：
 *   TMDB_API_BASE=http://127.0.0.1:<E2E_TMDB_MOCK_PORT>/3
 *   CULTURE_API_BASE=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/culture CULTURE_CACHE_TTL_MS=0
 *   APPLE_TOP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/top.json ITUNES_LOOKUP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/lookup
 * 雲端有大量真活動：文化部假資料的演出、音樂祭、展覽都放在澎湖縣（真資料很少），測試帳號先選澎湖縣再找自己的卡（fixtures/before-city.ts）。
 * BEFORESRC_SHOTS=1 時輸出 375／1280 寬截圖到 design/beforesrc-preview-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { QUIET_CITY, saveBeforeCity } from "./fixtures/before-city";
import { startCultureMock, taipeiDayFromNow, type CultureMock } from "./fixtures/culture/mock-server";
import { expect, test } from "./fixtures/test";
import { OTHER_MOVIE, startTmdbMock, TREND_SERIES, type TmdbMock } from "./fixtures/tmdb-mock";

const SHOTS = process.env.BEFORESRC_SHOTS === "1";
const ATTRIBUTION = "資料來源：文化部文化資料開放服務網";

test.use({ hasTouch: true });

let tmdb: TmdbMock;
let culture: CultureMock;

test.beforeAll(async () => {
  tmdb = await startTmdbMock();
  const address = QUIET_CITY.address;
  culture = await startCultureMock(Date.now().toString(36).slice(-5), { located: { concert: address, festival: address, exhibition: address } });
});

test.afterAll(async () => {
  await Promise.all([tmdb?.close(), culture?.close()]);
});

async function shot(page: Page, name: string, width?: number): Promise<void> {
  if (!SHOTS) return;
  const viewport = page.viewportSize();
  if (!viewport) return;
  const target = width ?? viewport.width;
  await page.setViewportSize({ width: target, height: viewport.height });
  await page.waitForTimeout(400);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: target, height: Math.max(height, viewport.height) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `design/beforesrc-preview-${name}.png` });
  await page.setViewportSize(viewport);
}

const mmdd = (day: string) => `${day.slice(5, 7)}.${day.slice(8, 10)}`;

function card(region: Locator, title: string): Locator {
  return region.getByRole("article").filter({ has: region.page().getByRole("heading", { name: title, exact: true }) });
}

/** 第一次用介面記下會先帶去權限引導：按「先不用」回來 */
async function skipPermissionPrompt(page: Page): Promise<void> {
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 5_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/notifications"), { timeout: 30_000 });
  }
}

test("散場之前同時有電影、影集、Podcast、演出、展覽；來源掛掉只少那區；分類切換；排進行程進日誌", async ({ page, accounts }) => {
  const { concert, festival, exhibition, podcast } = culture.fixture;
  culture.setCultureDown(true);
  const email = accounts.newEmail("mix");
  await loginAsNewUser(page, email, "/before");
  await saveBeforeCity(page, QUIET_CITY.name);
  const userId = await accounts.userIdOf(email);
  const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
  const tabs = page.getByRole("group", { name: "分類" });

  await test.step("文化部掛掉：頁面照常（電影、影集、Podcast、你排好的都在），只少文化部的演出與展覽", async () => {
    await page.goto("/before");
    await expect(card(thisWeek, OTHER_MOVIE.title)).toBeVisible();
    await expect(card(thisWeek, TREND_SERIES.name)).toBeVisible();
    await expect(card(thisWeek, podcast.name)).toBeVisible();
    await expect(page.getByRole("region", { name: "你排好的" })).toBeVisible();
    await expect(thisWeek.getByText(concert.title)).toHaveCount(0);
    await expect(thisWeek.getByText(exhibition.title)).toHaveCount(0);
    await expect(page.getByText(ATTRIBUTION)).toHaveCount(0);
    await expect(tabs.getByRole("button", { name: "Podcast" })).toBeVisible();
    expect(culture.hits.some((hit) => hit.startsWith("/culture"))).toBe(true);
    await shot(page, "outage");
  });

  await test.step("文化部恢復：五種都在第一屏，演出／音樂祭／展覽的 meta 與資料來源署名", async () => {
    culture.setCultureDown(false);
    await page.reload();
    await expect(page.getByText(ATTRIBUTION)).toBeVisible();
    for (const label of ["全部", "電影", "影集", "Podcast", "演出", "展覽"]) {
      await expect(tabs.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(tabs.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    for (const title of [OTHER_MOVIE.title, TREND_SERIES.name, podcast.name, concert.title, exhibition.title]) {
      await expect(card(thisWeek, title)).toBeVisible();
    }
    await expect(card(thisWeek, concert.title).getByText(`演出・${QUIET_CITY.short}・${concert.venue}・${mmdd(concert.day)}`)).toBeVisible();
    await expect(card(thisWeek, concert.title).getByRole("link", { name: `購票：${concert.title}（另開視窗）` })).toHaveAttribute(
      "href",
      "https://www.opentix.life/event/e2e",
    );
    // 展至：同一年寫 MM.DD，跨年寫 YYYY.MM.DD
    const until = exhibition.end.slice(0, 4) === taipeiDayFromNow(0).slice(0, 4) ? mmdd(exhibition.end) : exhibition.end.replaceAll("-", ".");
    await expect(card(thisWeek, exhibition.title).getByText(`展覽・${QUIET_CITY.short}・${exhibition.venue}・展至 ${until}`)).toBeVisible();
    await expect(card(thisWeek, podcast.name).getByText("Podcast・本週榜單")).toBeVisible();
    // 已經結束的演出不出現
    await expect(thisWeek.getByText("上個月的演出")).toHaveCount(0);
    await shot(page, "all");
    await shot(page, "all-1280", 1280);
  });

  await test.step("分類切換（觸控）：演出只剩演出（含音樂祭）、展覽只剩展覽", async () => {
    await waitForHydration(page, 'div[aria-label="分類"] button');
    await tabs.getByRole("button", { name: "演出" }).tap();
    await expect(tabs.getByRole("button", { name: "演出" })).toHaveAttribute("aria-pressed", "true");
    await expect(card(thisWeek, concert.title)).toBeVisible();
    await expect(card(thisWeek, festival.title).getByText(`音樂祭・${QUIET_CITY.short}・${festival.venue}・${mmdd(festival.start)} – ${mmdd(festival.end)}`)).toBeVisible();
    await expect(card(thisWeek, OTHER_MOVIE.title)).toHaveCount(0);
    await expect(card(thisWeek, exhibition.title)).toHaveCount(0);
    await shot(page, "filter-live");

    await tabs.getByRole("button", { name: "展覽" }).tap();
    await expect(card(thisWeek, exhibition.title)).toBeVisible();
    await expect(card(thisWeek, concert.title)).toHaveCount(0);

    await tabs.getByRole("button", { name: "Podcast" }).tap();
    await expect(card(thisWeek, podcast.name)).toBeVisible();
    await expect(card(thisWeek, OTHER_MOVIE.title)).toHaveCount(0);
  });

  await test.step("Podcast 排進行程：讀 RSS 預選最新一集，在家、選日期時間", async () => {
    await card(thisWeek, podcast.name).getByRole("button", { name: `排進行程：${podcast.name}` }).click();
    const sheet = page.getByRole("dialog", { name: "記一筆" });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    // 作品列預選這個節目（sheet 顯示節目名）；作品本身是 RSS 裡最新的那一集（第 2 集，RSS 排在後面）
    await expect(sheet.getByText(podcast.name).first()).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "在家" })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByRole("radio", { name: "選日期時間" })).toHaveAttribute("aria-checked", "true");
    await shot(page, "podcast-sheet");
    const works = await rest<{ id: string; title: string; kind: string }>("works", "select=id,title,kind&episode_guid=eq.e2e-beforesrc-ep2");
    expect(works).toEqual([expect.objectContaining({ title: podcast.latestEpisode, kind: "podcast_episode" })]);
    accounts.trackWork(works[0].id);
    await sheet.getByRole("button", { name: "關閉" }).click();
    await expect(sheet).toBeHidden();
  });

  await test.step("演出排進行程：預填名稱、場地、場次時間 → 計畫中 → 日誌接下來看得到", async () => {
    await tabs.getByRole("button", { name: "演出" }).tap();
    await card(thisWeek, concert.title).getByRole("button", { name: `排進行程：${concert.title}` }).click();
    const sheet = page.getByRole("dialog", { name: "記一筆" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "演出名或展覽名" })).toHaveValue(concert.title);
    await expect(sheet.getByRole("radio", { name: "音樂祭/演出" })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByLabel("日期時間")).toHaveValue(`${concert.day}T${concert.time}`);
    await shot(page, "live-sheet");

    await sheet.getByRole("button", { name: "排進行程" }).click();
    await expect(page.getByText("散場誌・計畫")).toBeVisible();
    await expect(sheet).toBeHidden({ timeout: 10_000 });
    await skipPermissionPrompt(page);

    const entries = await rest<{ status: string; work_id: string; works: { title: string; venue: string | null; event_date: string | null } }>(
      "journal_entries",
      `select=status,work_id,works(title,venue,event_date)&user_id=eq.${userId}`,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: "planned", works: { title: concert.title, venue: concert.venue, event_date: concert.day } });
    accounts.trackWork(entries[0].work_id);

    await page.goto("/journal");
    await expect(page.getByRole("region", { name: "接下來" }).getByText(concert.title)).toBeVisible();
    await shot(page, "journal-upcoming");
  });
});
