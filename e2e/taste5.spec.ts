/**
 * 品味問卷 3 題改 5 題（Q-63）：
 * - 勾演出：①～⑤都出現（品味・n/5）；④選縣市 → 寫進散場之前既有的縣市設定（settings before_city:<userId>），
 *   打開散場之前縣市選單就是那個縣市；⑤複選演唱會＋音樂祭 → 存 settings taste_live:<userId>，
 *   散場之前演出分頁裡選了的細類排在其他演出前面（測試種的演唱會比戲劇晚開演，沒偏好時戲劇在前）
 * - 沒勾演出、展覽：只有 3 題（第 3 題就是「完成」），不寫縣市與演出種類；中途勾展覽會多出縣市一題、取消又回 3 題
 * 測試活動打 ingest API 種在真資料很少的縣市（fixtures/before-city.ts），只動 e2e- 前綴。
 * TASTE5_SHOTS=1 時輸出 375 寬截圖到 test-results/polish5/taste5-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { completePenName, followAdminLoginLink, waitForHydration } from "./fixtures/auth";
import { QUIET_CITY } from "./fixtures/before-city";
import { taipeiDayFromNow } from "./fixtures/culture/mock-server";
import { deleteTestEvents } from "./fixtures/events-table";
import { expect, test } from "./fixtures/test";

const SHOTS = process.env.TASTE5_SHOTS === "1";
const RUN = Date.now().toString(36).slice(-5);
// 散場之前要打外部熱門榜＋現算配對，機器忙時首次渲染會超過 10 秒
const BEFORE_TIMEOUT_MS = 45_000;

const THEATRE = { title: `散場測試・偏好戲劇 ${RUN}`, day: taipeiDayFromNow(3), venue: "西瀛表演廳" };
const CONCERT = { title: `散場測試・偏好演唱會 ${RUN}`, day: taipeiDayFromNow(9), venue: "觀音亭園區" };

test.use({ hasTouch: true });

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
  await page.screenshot({ path: `test-results/polish5/taste5-${name}.png`, fullPage: true });
}

async function openQuestionnaire(page: Page, email: string): Promise<void> {
  await followAdminLoginLink(page, email, "/before");
  await completePenName(page, { stayOnTaste: true });
  await expect(page).toHaveURL(/\/onboarding\/taste/);
  await waitForHydration(page, 'button[role="checkbox"]');
}

async function nextStep(page: Page, counter: string): Promise<void> {
  await page.getByRole("button", { name: "下一題" }).tap();
  await expect(page.getByText(counter, { exact: true })).toBeVisible();
}

function card(region: Locator, title: string): Locator {
  return region.getByRole("article").filter({ has: region.page().getByRole("heading", { name: title, exact: true }) });
}

test("勾演出：5 題都出現；縣市帶進散場之前，演出種類讓選了的排前面", async ({ page, accounts }) => {
  test.setTimeout(240_000);

  await test.step("種資料：同一個冷門縣市的戲劇（先開演）與演唱會（後開演）", async () => {
    const response = await page.request.post("/api/events/ingest", {
      headers: { "x-api-key": process.env.API_SECRET_KEY ?? "" },
      data: { source: "kktix", events: [show("theatre", THEATRE, "theatre"), show("concert", CONCERT, "concert")] },
    });
    expect(response.status()).toBe(200);
  });

  const email = accounts.newEmail("taste5");
  await openQuestionnaire(page, email);
  const userId = await accounts.userIdOf(email);

  await test.step("①勾演出：題數變 5", async () => {
    await expect(page.getByText("品味・1/3", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "演出" }).tap();
    await expect(page.getByText("品味・1/5", { exact: true })).toBeVisible();
    await shot(page, "1-media");
  });

  await test.step("②③照舊（不答直接下一題）", async () => {
    await nextStep(page, "品味・2/5");
    await expect(page.getByRole("heading", { name: "比較常在家，還是出門？" })).toBeVisible();
    await nextStep(page, "品味・3/5");
    await expect(page.getByRole("heading", { name: "挑 3 部看過或想看的" })).toBeVisible();
    await expect(page.getByRole("button", { name: "下一題" })).toBeVisible();
  });

  await test.step(`④縣市：22 縣市＋都可以，單選 ${QUIET_CITY.name}`, async () => {
    await nextStep(page, "品味・4/5");
    await expect(page.getByRole("heading", { name: "常在哪個縣市看演出、看展？" })).toBeVisible();
    const cities = page.getByRole("radiogroup", { name: "常在哪個縣市看演出、看展" }).getByRole("radio");
    await expect(cities).toHaveCount(23);
    await expect(cities.first()).toHaveText("都可以");
    await cities.filter({ hasText: QUIET_CITY.name }).tap();
    await expect(cities.filter({ hasText: QUIET_CITY.name })).toHaveAttribute("aria-checked", "true");
    await expect(cities.first()).toHaveAttribute("aria-checked", "false");
    await shot(page, "4-city");
  });

  await test.step("⑤演出種類：複選演唱會＋音樂祭，最後一題是完成", async () => {
    await nextStep(page, "品味・5/5");
    await expect(page.getByRole("heading", { name: "演出想看哪種？" })).toBeVisible();
    const kinds = page.getByRole("group", { name: "演出想看哪種" }).getByRole("checkbox");
    await expect(kinds).toHaveText(["演唱會", "獨立音樂", "戲劇", "舞蹈", "音樂祭"]);
    await kinds.filter({ hasText: "音樂祭" }).tap();
    await kinds.filter({ hasText: "演唱會" }).tap();
    await expect(kinds.filter({ hasText: "演唱會" })).toHaveAttribute("aria-checked", "true");
    await shot(page, "5-live");
    await page.getByRole("button", { name: "完成" }).tap();
    await expect(page).toHaveURL(/\/before$/, { timeout: BEFORE_TIMEOUT_MS });
  });

  await test.step("存檔：問卷、縣市（散場之前既有設定）、演出種類", async () => {
    const [profile] = await rest<{ media: string[]; setting: string | null }>("taste_profiles", `select=media,setting&user_id=eq.${userId}`);
    expect(profile).toEqual({ media: ["live"], setting: null });
    const [city] = await rest<{ value: { city: string | null } }>("settings", `select=value&key=eq.before_city:${userId}`);
    expect(city.value).toEqual({ city: QUIET_CITY.name });
    const [live] = await rest<{ value: { kinds: string[] } }>("settings", `select=value&key=eq.taste_live:${userId}`);
    expect(live.value).toEqual({ kinds: ["concert", "festival"] });
    // 沒挑作品：不寫 taste_picks、不寫日誌
    expect(await rest("settings", `select=key&key=eq.taste_picks:${userId}`)).toHaveLength(0);
    expect(await rest("journal_entries", `select=id&user_id=eq.${userId}`)).toHaveLength(0);
  });

  await test.step("散場之前：縣市選單是問卷選的縣市；演出分頁演唱會排在先開演的戲劇前面", async () => {
    const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
    await waitForHydration(page, 'div[aria-label="分類"] button');
    await expect(page.getByLabel("在哪個縣市")).toHaveValue(QUIET_CITY.name);
    await page.getByRole("group", { name: "分類" }).getByRole("button", { name: "演出" }).tap();
    await expect(card(thisWeek, CONCERT.title)).toBeVisible();
    await expect(card(thisWeek, THEATRE.title)).toBeVisible();
    const titles = await thisWeek.getByRole("article").getByRole("heading").allTextContents();
    expect(titles.indexOf(CONCERT.title)).toBeLessThan(titles.indexOf(THEATRE.title));
    await shot(page, "before-live");
  });
});

test("沒勾演出、展覽：只有 3 題，不寫縣市與演出種類；中途勾展覽多出縣市一題", async ({ page, accounts }) => {
  const email = accounts.newEmail("taste3");
  await openQuestionnaire(page, email);
  const userId = await accounts.userIdOf(email);

  await test.step("勾展覽：4 題（問縣市、不問演出種類）；取消又回 3 題", async () => {
    await page.getByRole("checkbox", { name: "展覽" }).tap();
    await expect(page.getByText("品味・1/4", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "展覽" }).tap();
    await expect(page.getByText("品味・1/3", { exact: true })).toBeVisible();
  });

  await test.step("只勾電影：3 題，第 3 題就是完成", async () => {
    await page.getByRole("checkbox", { name: "電影" }).tap();
    await expect(page.getByText("品味・1/3", { exact: true })).toBeVisible();
    await nextStep(page, "品味・2/3");
    await page.getByRole("radiogroup", { name: "在家還是出門" }).getByRole("radio", { name: "在家" }).tap();
    await nextStep(page, "品味・3/3");
    await expect(page.getByRole("button", { name: "下一題" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "常在哪個縣市看演出、看展？" })).toHaveCount(0);
    await shot(page, "3-only");
    await page.getByRole("button", { name: "完成" }).tap();
    await expect(page).toHaveURL(/\/before$/, { timeout: BEFORE_TIMEOUT_MS });
  });

  await test.step("存檔：只有前兩題；沒有縣市、演出種類", async () => {
    const [profile] = await rest<{ media: string[]; setting: string | null }>("taste_profiles", `select=media,setting&user_id=eq.${userId}`);
    expect(profile).toEqual({ media: ["movie"], setting: "home" });
    expect(await rest("settings", `select=key&key=eq.before_city:${userId}`)).toHaveLength(0);
    expect(await rest("settings", `select=key&key=eq.taste_live:${userId}`)).toHaveLength(0);
  });
});
