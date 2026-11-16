/**
 * 散場之前演出細分類＋縣市篩選（livefilter）：
 * - 演出分頁下的小標籤（演唱會／獨立音樂／戲劇／舞蹈／音樂祭）切換只剩該類（觸控）；卡片 meta 有縣市簡稱
 * - 縣市選單在「全部」與演出、展覽分頁，電影等分頁沒有
 * - 選縣市 → 演出、展覽、全部都只剩該縣市（沒有縣市資料的不出現），電影照常；存在 settings，重新整理還記得
 * - 該縣市沒有這一類 → 一句話空狀態；API 要登入、縣市要在 22 縣市白名單內
 * 不打外網：活動由測試打 ingest API 種進本地 DB（不同縣市、不同細類）；TMDB、文化部、Apple 榜用本機假 server
 * （文化部多一場帶高雄地址的戲劇）。dev server 要帶：
 *   TMDB_API_BASE=http://127.0.0.1:<E2E_TMDB_MOCK_PORT>/3
 *   CULTURE_API_BASE=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/culture CULTURE_CACHE_TTL_MS=0
 *   APPLE_TOP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/top.json ITUNES_LOOKUP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/lookup
 * 雲端有大量真活動（臺北、高雄每月上百場）：測試活動放在真資料很少的三個縣市（澎湖、金門、花蓮，fixtures/before-city.ts），
 * 小標籤與篩選都在選了縣市之後驗；縣市選單的排序與「全部縣市」的卡片內容由真資料決定，不再斷言。
 * LIVEFILTER_SHOTS=1 時輸出 375 寬截圖到 design/livefilter-preview-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { QUIET_CITY as HOME, QUIET_CITY_B as OTHER, QUIET_CITY_C as EMPTY } from "./fixtures/before-city";
import { startCultureMock, taipeiDayFromNow, type CultureMock } from "./fixtures/culture/mock-server";
import { deleteTestEvents } from "./fixtures/events-table";
import { expect, test } from "./fixtures/test";
import { startTmdbMock, type TmdbMock } from "./fixtures/tmdb-mock";

const SHOTS = process.env.LIVEFILTER_SHOTS === "1";
const RUN = Date.now().toString(36).slice(-5);

// HOME（澎湖）：演唱會＋舞蹈＋展覽；文化部的戲劇、獨立音樂、音樂祭也帶 HOME 地址 → 五種細類都在
const HOME_CONCERT = { title: `散場測試・海港演唱會 ${RUN}`, day: taipeiDayFromNow(4), venue: "觀音亭園區", city: HOME.name };
const HOME_DANCE = { title: `散場測試・海風舞團 ${RUN}`, day: taipeiDayFromNow(6), venue: "西瀛表演廳", city: HOME.name };
// OTHER（金門）：戲劇＋展覽；EMPTY（花蓮）：只有舞蹈，沒有展覽
const OTHER_THEATRE = { title: `散場測試・城南劇團新作 ${RUN}`, day: taipeiDayFromNow(5), venue: "金城劇場", city: OTHER.name };
const EMPTY_DANCE = { title: `散場測試・洄瀾舞團 ${RUN}`, day: taipeiDayFromNow(7), venue: "文創園區劇場", city: EMPTY.name };
const OTHER_EXPO = { title: `散場測試・北美館縣市展 ${RUN}`, city: OTHER.name };
const HOME_EXPO = { title: `散場測試・高美館縣市展 ${RUN}`, city: HOME.name };

test.use({ hasTouch: true });

let tmdb: TmdbMock;
let culture: CultureMock;

function seed(source: string, id: string, fields: Record<string, unknown>) {
  const url = `https://e2e-${RUN}.example.com/${source}/${id}`;
  return { source, sourceId: `e2e-${RUN}-${id}`, showTimes: [], ticketUrls: [], imageUrl: null, sourceUrl: url, ...fields };
}

function show(source: string, id: string, item: { title: string; day: string; venue: string; city: string }, category: string) {
  return seed(source, id, {
    title: item.title,
    category,
    venue: item.venue,
    city: item.city,
    startsOn: item.day,
    endsOn: item.day,
    showTimes: [{ date: item.day, time: "19:30" }],
  });
}

function expo(source: string, id: string, item: { title: string; city: string }, venue: string) {
  return seed(source, id, { title: item.title, category: "exhibition", venue, city: item.city, startsOn: taipeiDayFromNow(-5), endsOn: taipeiDayFromNow(40) });
}

async function ingest(page: Page, source: string, events: unknown[]): Promise<void> {
  const response = await page.request.post("/api/events/ingest", { headers: { "x-api-key": process.env.API_SECRET_KEY ?? "" }, data: { source, events } });
  expect(response.status()).toBe(200);
}

test.beforeAll(async () => {
  tmdb = await startTmdbMock();
  culture = await startCultureMock(RUN, { addressed: true, located: { addressed: HOME.address, indie: HOME.address, festival: HOME.address } });
  await deleteTestEvents(`e2e-${RUN}-`);
});

test.afterAll(async () => {
  await deleteTestEvents(`e2e-${RUN}-`);
  await Promise.all([tmdb?.close(), culture?.close()]);
});

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const viewport = page.viewportSize();
  if (!viewport) return;
  await page.waitForTimeout(400);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `design/livefilter-preview-${name}.png` });
  await page.setViewportSize(viewport);
}

/** POLISH5_SHOTS=1：小標籤那一帶的 375／1440 截圖（10/15 四項小改的佐證，test-results/polish5/） */
async function polishShot(page: Page, subs: Locator, name: string): Promise<void> {
  if (process.env.POLISH5_SHOTS !== "1") return;
  await page.waitForTimeout(300);
  const box = await subs.boundingBox();
  if (!box) return;
  const width = page.viewportSize()?.width ?? 375;
  await page.screenshot({ path: `test-results/polish5/${name}.png`, clip: { x: 0, y: Math.max(0, box.y - 160), width, height: box.height + 420 } });
}

function card(region: Locator, title: string): Locator {
  return region.getByRole("article").filter({ has: region.page().getByRole("heading", { name: title, exact: true }) });
}

/** 選縣市：等存檔 API 回 200，再等 router.refresh 換完卡（存檔＋重抓期間 select 停用；本機負載高時重抓要十幾秒） */
async function chooseCity(page: Page, city: string, settled: Locator): Promise<void> {
  const select = page.getByLabel("在哪個縣市");
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/before/city") && response.request().method() === "POST");
  await select.selectOption(city === "全部縣市" ? "" : city);
  expect((await saved).status()).toBe(200);
  await expect(select).toBeEnabled({ timeout: 60_000 });
  await expect(settled).toBeVisible();
}

test("演出細分類小標籤＋出門類縣市篩選：只剩該類、只剩該縣市、記住選擇、空狀態", async ({ page, accounts, request }) => {
  const { concert, festival, exhibition, addressed, indie } = culture.fixture;

  await test.step("種資料：不同縣市、不同細類的演出與展覽", async () => {
    await ingest(page, "kktix", [show("kktix", "home-concert", HOME_CONCERT, "concert"), show("kktix", "empty-dance", EMPTY_DANCE, "dance")]);
    await ingest(page, "opentix", [show("opentix", "other-theatre", OTHER_THEATRE, "theatre"), show("opentix", "home-dance", HOME_DANCE, "dance")]);
    await ingest(page, "tfam", [expo("tfam", "other-expo", OTHER_EXPO, "臺北市立美術館")]);
    await ingest(page, "kdmofa", [expo("kdmofa", "home-expo", HOME_EXPO, "高雄市立美術館")]);
  });

  await test.step("API：未登入 401", async () => {
    expect((await request.post("/api/before/city", { data: { city: "臺北市" } })).status()).toBe(401);
  });

  const email = accounts.newEmail("livefilter");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);
  const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
  const tabs = page.getByRole("group", { name: "分類" });
  const subs = page.getByRole("group", { name: "演出類型" });
  const citySelect = page.getByLabel("在哪個縣市");

  await test.step("API：登入後縣市不在白名單 400", async () => {
    expect((await page.request.post("/api/before/city", { data: { city: "台北" } })).status()).toBe(400);
    expect((await page.request.post("/api/before/city", { data: { city: "東京都" } })).status()).toBe(400);
  });

  await test.step("縣市選單：全部分頁有、電影分頁沒有；選項含三個測試縣市", async () => {
    await page.goto("/before");
    await waitForHydration(page, 'div[aria-label="分類"] button');
    // 全部分頁沒有小標籤，但有縣市選單（全部裡的演出、展覽卡也會被篩）；電影分頁沒有縣市選單
    await expect(subs).toHaveCount(0);
    await expect(citySelect).toHaveValue("");
    await tabs.getByRole("button", { name: "電影" }).tap();
    await expect(citySelect).toHaveCount(0);

    await tabs.getByRole("button", { name: "演出" }).tap();
    const options = await citySelect.locator("option").allTextContents();
    expect(options[0]).toBe("全部縣市");
    expect(options).toEqual(expect.arrayContaining([HOME.name, OTHER.name, EMPTY.name]));
  });

  const movieCount = await test.step("電影分頁的卡數（選縣市前）", async () => {
    await tabs.getByRole("button", { name: "電影" }).tap();
    const count = await thisWeek.getByRole("article").count();
    expect(count).toBeGreaterThan(0);
    return count;
  });

  await test.step(`選${HOME.name}：演出小標籤（觸控）只列有資料的細類，切換只剩該類；卡片 meta 有縣市簡稱`, async () => {
    await tabs.getByRole("button", { name: "演出" }).tap();
    await chooseCity(page, HOME.name, card(thisWeek, HOME_CONCERT.title));
    await expect(tabs.getByRole("button", { name: "演出" })).toHaveAttribute("aria-pressed", "true");
    // 照固定順序：演唱會／獨立音樂／戲劇／舞蹈／音樂祭
    await expect(subs.getByRole("button")).toHaveText(["全部", "演唱會", "獨立音樂", "戲劇", "舞蹈", "音樂祭"]);
    await expect(subs.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    await expect(card(thisWeek, addressed.title)).toBeVisible();
    // 沒有縣市資料的（文化部弦樂之夜）與別的縣市都不出現
    for (const title of [concert.title, OTHER_THEATRE.title, EMPTY_DANCE.title]) await expect(card(thisWeek, title)).toHaveCount(0);
    // 375 寬 6 個小標籤放不下一列：換行，不橫向捲動、不截斷（10/15）
    expect(await subs.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const chipBoxes = await subs.getByRole("button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect));
    expect(new Set(chipBoxes.map((box) => Math.round(box.top))).size).toBeGreaterThan(1);
    for (const box of chipBoxes) expect(box.right).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
    await shot(page, "live-chips");
    await polishShot(page, subs, "chips-375");
    await page.setViewportSize({ width: 1440, height: 900 });
    await polishShot(page, subs, "chips-1440");
    await page.setViewportSize({ width: 375, height: 812 });

    await subs.getByRole("button", { name: "戲劇" }).tap();
    await expect(subs.getByRole("button", { name: "戲劇" })).toHaveAttribute("aria-pressed", "true");
    await expect(card(thisWeek, addressed.title)).toBeVisible();
    await expect(card(thisWeek, HOME_CONCERT.title)).toHaveCount(0);
    await expect(card(thisWeek, HOME_DANCE.title)).toHaveCount(0);
    // meta 補縣市簡稱（放場地前面）；文化部從地址推
    await expect(card(thisWeek, addressed.title).getByText(`演出・${HOME.short}・${addressed.venue}・`)).toBeVisible();

    await subs.getByRole("button", { name: "獨立音樂" }).tap();
    await expect(subs.getByRole("button", { name: "獨立音樂" })).toHaveAttribute("aria-pressed", "true");
    await expect(card(thisWeek, indie.title)).toBeVisible();
    await expect(card(thisWeek, festival.title)).toHaveCount(0);
    await expect(card(thisWeek, addressed.title)).toHaveCount(0);

    await subs.getByRole("button", { name: "舞蹈" }).tap();
    await expect(card(thisWeek, HOME_DANCE.title)).toBeVisible();
    await expect(card(thisWeek, addressed.title)).toHaveCount(0);

    await subs.getByRole("button", { name: "音樂祭" }).tap();
    await expect(card(thisWeek, festival.title)).toBeVisible();
    await expect(card(thisWeek, HOME_DANCE.title)).toHaveCount(0);
    await shot(page, "live-festival");

    await subs.getByRole("button", { name: "全部" }).tap();
    await expect(card(thisWeek, HOME_CONCERT.title)).toBeVisible();
    // events.city 推的 meta
    await expect(card(thisWeek, HOME_CONCERT.title).getByText(`演出・${HOME.short}・${HOME_CONCERT.venue}・`)).toBeVisible();
    await expect(card(thisWeek, addressed.title)).toBeVisible();
    await shot(page, "city-home");
  });

  await test.step(`${HOME.name}：展覽、全部也只剩該縣市，電影照常；存進 settings`, async () => {
    await tabs.getByRole("button", { name: "展覽" }).tap();
    await expect(card(thisWeek, HOME_EXPO.title)).toBeVisible();
    await expect(card(thisWeek, OTHER_EXPO.title)).toHaveCount(0);
    await expect(card(thisWeek, exhibition.title)).toHaveCount(0);
    await expect(citySelect).toHaveValue(HOME.name);

    await tabs.getByRole("button", { name: "全部" }).tap();
    await expect(citySelect).toHaveValue(HOME.name);
    for (const title of [OTHER_THEATRE.title, EMPTY_DANCE.title, OTHER_EXPO.title, concert.title, exhibition.title]) await expect(card(thisWeek, title)).toHaveCount(0);
    await shot(page, "all-city");

    await tabs.getByRole("button", { name: "電影" }).tap();
    await expect(thisWeek.getByRole("article")).toHaveCount(movieCount);
    await expect(citySelect).toHaveCount(0);

    const [stored] = await rest<{ value: { city: string | null } }>("settings", `select=value&key=eq.before_city:${userId}`);
    expect(stored.value).toEqual({ city: HOME.name });
  });

  await test.step(`重新整理還記得${HOME.name}`, async () => {
    await page.reload();
    await waitForHydration(page, 'div[aria-label="分類"] button');
    await tabs.getByRole("button", { name: "演出" }).tap();
    await expect(citySelect).toHaveValue(HOME.name);
    await expect(card(thisWeek, HOME_CONCERT.title)).toBeVisible();
    await expect(card(thisWeek, OTHER_THEATRE.title)).toHaveCount(0);
  });

  await test.step(`換${OTHER.name}：只剩那裡的戲劇與展覽`, async () => {
    await chooseCity(page, OTHER.name, card(thisWeek, OTHER_THEATRE.title));
    await expect(card(thisWeek, HOME_CONCERT.title)).toHaveCount(0);
    await expect(card(thisWeek, OTHER_THEATRE.title).getByText(`演出・${OTHER.short}・${OTHER_THEATRE.venue}・`)).toBeVisible();
    await tabs.getByRole("button", { name: "展覽" }).tap();
    await expect(card(thisWeek, OTHER_EXPO.title)).toBeVisible();
    await expect(card(thisWeek, HOME_EXPO.title)).toHaveCount(0);
  });

  await test.step(`${EMPTY.name}沒有展覽：一句話空狀態，分頁還在、換得回來`, async () => {
    await tabs.getByRole("button", { name: "演出" }).tap();
    await chooseCity(page, EMPTY.name, card(thisWeek, EMPTY_DANCE.title));
    await tabs.getByRole("button", { name: "展覽" }).tap();
    await expect(thisWeek.getByText(`這 30 天${EMPTY.name}沒有展覽，換個縣市看看`)).toBeVisible();
    await expect(thisWeek.getByRole("article")).toHaveCount(0);
    await shot(page, "empty");

    // 全部縣市：卡片內容由雲端真資料決定（測試卡可能被擠出上限），只驗選單與存檔回到全部縣市、展覽分頁有卡
    await chooseCity(page, "全部縣市", thisWeek.getByRole("article").first());
    await expect(citySelect).toHaveValue("");
    const [stored] = await rest<{ value: { city: string | null } }>("settings", `select=value&key=eq.before_city:${userId}`);
    expect(stored.value).toEqual({ city: null });
  });
});
