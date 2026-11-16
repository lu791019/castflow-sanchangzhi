/**
 * 設定頁「品味」可改④縣市、⑤演出種類（Dex 10/15）：
 * - 顯示條件同問卷：①沒勾演出／展覽時沒有④⑤；勾展覽多出④；勾演出④⑤都有
 * - ④改縣市 → 寫散場之前既有的縣市設定（settings before_city:<userId>），打開散場之前縣市選單跟著變
 * - ⑤改演出種類 → settings taste_live:<userId>，散場之前演出分頁選了的細類排到前面（測試種的演唱會比戲劇晚開演，沒偏好時戲劇在前）
 * - ⑤全部取消寫成空的；①取消演出時④⑤收起、已存的不刪
 * 測試活動打 ingest API 種在真資料很少的縣市（fixtures/before-city.ts），只動 e2e- 前綴。
 * TASTESETTINGS_SHOTS=1 時輸出截圖到 test-results/formwidth/tastesettings-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { QUIET_CITY } from "./fixtures/before-city";
import { taipeiDayFromNow } from "./fixtures/culture/mock-server";
import { deleteTestEvents } from "./fixtures/events-table";
import { expect, test } from "./fixtures/test";

const SHOTS = process.env.TASTESETTINGS_SHOTS === "1";
const RUN = Date.now().toString(36).slice(-5);
// 散場之前要打外部熱門榜＋現算配對，機器忙時首次渲染會超過 10 秒
const BEFORE_TIMEOUT_MS = 45_000;
const SAVE_TIMEOUT_MS = 30_000;

const THEATRE = { title: `散場測試・設定戲劇 ${RUN}`, day: taipeiDayFromNow(3), venue: "西瀛表演廳" };
const CONCERT = { title: `散場測試・設定演唱會 ${RUN}`, day: taipeiDayFromNow(9), venue: "觀音亭園區" };

function show(id: string, item: { title: string; day: string; venue: string }, category: string) {
  return {
    source: "kktix",
    sourceId: `e2e-${RUN}-${id}`,
    title: item.title,
    category,
    venue: item.venue,
    city: QUIET_CITY.name,
    startsOn: item.day,
    endsOn: item.day,
    showTimes: [{ date: item.day, time: "19:30" }],
    ticketUrls: [],
    imageUrl: null,
    sourceUrl: `https://e2e-${RUN}.example.com/kktix/${id}`,
  };
}

test.afterAll(async () => {
  await deleteTestEvents(`e2e-${RUN}-`);
});

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/formwidth/tastesettings-${name}.png`, fullPage: true });
}

function taste(page: Page): Locator {
  return page.getByRole("region", { name: /品味/ });
}

function cities(page: Page): Locator {
  return taste(page).getByRole("radiogroup", { name: "常在哪個縣市看演出、看展" });
}

function liveKinds(page: Page): Locator {
  return taste(page).getByRole("group", { name: "演出想看哪種" });
}

async function openSettings(page: Page): Promise<void> {
  await page.goto("/me/settings");
  await expect(taste(page)).toBeVisible({ timeout: 20_000 });
  await waitForHydration(page, 'button[role="checkbox"]');
}

async function storedCity(userId: string): Promise<unknown> {
  return (await rest<{ value: { city: string | null } }>("settings", `select=value&key=eq.before_city:${userId}`))[0]?.value;
}

async function storedKinds(userId: string): Promise<unknown> {
  return (await rest<{ value: { kinds: string[] } }>("settings", `select=value&key=eq.taste_live:${userId}`))[0]?.value;
}

/** 散場之前演出分頁：兩張測試卡的先後（標題清單） */
async function liveOrder(page: Page): Promise<string[]> {
  await page.goto("/before");
  const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
  await waitForHydration(page, 'div[aria-label="分類"] button');
  await expect(page.getByLabel("在哪個縣市")).toHaveValue(QUIET_CITY.name, { timeout: BEFORE_TIMEOUT_MS });
  await page.getByRole("group", { name: "分類" }).getByRole("button", { name: "演出" }).click();
  for (const title of [CONCERT.title, THEATRE.title]) {
    await expect(thisWeek.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })).toBeVisible();
  }
  const titles = await thisWeek.getByRole("article").getByRole("heading").allTextContents();
  return titles.filter((title) => title === CONCERT.title || title === THEATRE.title);
}

test("設定頁品味：④縣市、⑤演出種類可改，散場之前跟著變", async ({ page, accounts }) => {
  test.setTimeout(300_000);

  await test.step("種資料：同一個冷門縣市的戲劇（先開演）與演唱會（後開演）", async () => {
    const response = await page.request.post("/api/events/ingest", {
      headers: { "x-api-key": process.env.API_SECRET_KEY ?? "" },
      data: { source: "kktix", events: [show("theatre", THEATRE, "theatre"), show("concert", CONCERT, "concert")] },
    });
    expect(response.status()).toBe(200);
  });

  const email = accounts.newEmail("tasteset");
  await loginAsNewUser(page, email, "/me/settings");
  const userId = await accounts.userIdOf(email);

  await test.step("顯示條件同問卷：沒勾演出／展覽沒有④⑤；勾展覽只多④；勾演出④⑤都有", async () => {
    await openSettings(page);
    const media = taste(page).getByRole("group", { name: "平常看什麼、聽什麼" });
    await expect(cities(page)).toHaveCount(0);
    await expect(liveKinds(page)).toHaveCount(0);
    await media.getByRole("checkbox", { name: "展覽" }).click();
    await expect(cities(page)).toBeVisible();
    await expect(liveKinds(page)).toHaveCount(0);
    await media.getByRole("checkbox", { name: "展覽" }).click();
    await expect(cities(page)).toHaveCount(0);
    await media.getByRole("checkbox", { name: "演出" }).click();
    await expect(cities(page)).toBeVisible();
    await expect(liveKinds(page)).toBeVisible();
    await expect(cities(page).getByRole("radio")).toHaveCount(23);
    await expect(liveKinds(page).getByRole("checkbox")).toHaveText(["演唱會", "獨立音樂", "戲劇", "舞蹈", "音樂祭"]);
    await expect
      .poll(async () => (await rest<{ media: string[] }>("taste_profiles", `select=media&user_id=eq.${userId}`))[0]?.media, { timeout: SAVE_TIMEOUT_MS })
      .toEqual(["live"]);
    // 只改①：④⑤沒動就不寫
    expect(await storedCity(userId)).toBeUndefined();
    expect(await storedKinds(userId)).toBeUndefined();
  });

  await test.step(`④選 ${QUIET_CITY.name} → 散場之前縣市跟著變，沒偏好時先開演的戲劇在前`, async () => {
    await cities(page).getByRole("radio", { name: QUIET_CITY.name }).click();
    await expect(cities(page).getByRole("radio", { name: QUIET_CITY.name })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => storedCity(userId), { timeout: SAVE_TIMEOUT_MS }).toEqual({ city: QUIET_CITY.name });
    await shot(page, "settings-city");
    expect(await liveOrder(page)).toEqual([THEATRE.title, CONCERT.title]);
  });

  await test.step("⑤勾演唱會 → 散場之前演唱會排到戲劇前面；重開設定頁帶出已選", async () => {
    await openSettings(page);
    await expect(cities(page).getByRole("radio", { name: QUIET_CITY.name })).toHaveAttribute("aria-checked", "true");
    await liveKinds(page).getByRole("checkbox", { name: "演唱會" }).click();
    await expect.poll(() => storedKinds(userId), { timeout: SAVE_TIMEOUT_MS }).toEqual({ kinds: ["concert"] });
    expect(await storedCity(userId)).toEqual({ city: QUIET_CITY.name });
    await shot(page, "settings-live");
    expect(await liveOrder(page)).toEqual([CONCERT.title, THEATRE.title]);
    await shot(page, "before-live");
  });

  await test.step("⑤全部取消寫成空的；①取消演出時④⑤收起、已存的不刪", async () => {
    await openSettings(page);
    const concert = liveKinds(page).getByRole("checkbox", { name: "演唱會" });
    await expect(concert).toHaveAttribute("aria-checked", "true");
    await concert.click();
    await expect.poll(() => storedKinds(userId), { timeout: SAVE_TIMEOUT_MS }).toEqual({ kinds: [] });
    await liveKinds(page).getByRole("checkbox", { name: "舞蹈" }).click();
    await expect.poll(() => storedKinds(userId), { timeout: SAVE_TIMEOUT_MS }).toEqual({ kinds: ["dance"] });
    await taste(page).getByRole("group", { name: "平常看什麼、聽什麼" }).getByRole("checkbox", { name: "演出" }).click();
    await expect(cities(page)).toHaveCount(0);
    await expect(liveKinds(page)).toHaveCount(0);
    await expect
      .poll(async () => (await rest<{ media: string[] }>("taste_profiles", `select=media&user_id=eq.${userId}`))[0]?.media, { timeout: SAVE_TIMEOUT_MS })
      .toEqual([]);
    expect(await storedCity(userId)).toEqual({ city: QUIET_CITY.name });
    expect(await storedKinds(userId)).toEqual({ kinds: ["dance"] });
  });
});
