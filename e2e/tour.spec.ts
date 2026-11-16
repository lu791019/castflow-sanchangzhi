/**
 * 新手導覽（Dex 10/14 Q-49～Q-54）：訪客三步、登入者兩條路線、重播卡、略過後不再自動播、觸控；
 * 只按「下一步」也能走完每條路線（Dex 10/17：幫你點、不替人寫資料），手機 375 與寬螢幕 1440 各一次。
 * Playwright 下導覽預設不自動播（navigator.webdriver）；這裡用 force 旗標 castflow.tour-force=1。
 * TOUR_SHOTS=1 時輸出 375 寬每一步截圖到 design/tour-preview-*.png。
 */

import type { BrowserContext, Locator, Page } from "@playwright/test";
import { liveKey } from "../src/lib/venue/name";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { expect, test } from "./fixtures/test";

const SHOTS = process.env.TOUR_SHOTS === "1";
const DAY = 24 * 60 * 60 * 1000;
/** dev server 換頁第一次要編譯，機器忙時超過預設 10 秒 */
const NAV_TIMEOUT = 30_000;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `design/tour-preview-${name}.png` });
}

async function forceTour(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => window.localStorage.setItem("castflow.tour-force", "1"));
}

function tourCard(page: Page): Locator {
  return page.locator(".driver-popover.tour-card");
}

async function expectStep(page: Page, title: string | RegExp, eyebrow: string): Promise<Locator> {
  const card = tourCard(page);
  await expect(card.locator(".driver-popover-title")).toHaveText(title, { timeout: 15_000 });
  await expect(card.locator(".tour-eyebrow")).toHaveText(eyebrow);
  return card;
}

/** 卡片在 375 寬內、不蓋住被照亮的元素（等平滑捲動與卡片移動停下再量） */
async function expectCardFits(page: Page): Promise<void> {
  await expect(async () => {
    const box = await tourCard(page).boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375 + 0.5);
    const active = page.locator(".driver-active-element");
    if ((await active.count()) === 0 || (await active.getAttribute("id")) === "driver-dummy-element") return;
    const target = await active.boundingBox();
    if (!target) return;
    const overlapX = Math.min(box.x + box.width, target.x + target.width) - Math.max(box.x, target.x);
    const overlapY = Math.min(box.y + box.height, target.y + target.height) - Math.max(box.y, target.y);
    expect(overlapX > 1 && overlapY > 1, "導覽卡蓋住被照亮的元素").toBe(false);
  }).toPass({ timeout: 5_000 });
}

function taipeiDay(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 確保散場之前至少有一張卡（TMDB 抓不到時也有場外場刊） */
async function seedLiveWork(): Promise<string> {
  const key = serviceRoleKey();
  const title = `導覽測試巡迴 ${Date.now().toString(36)}`;
  const response = await fetch(`${supabaseUrl()}/rest/v1/works`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      kind: "live",
      title,
      slug: `e2e-tour-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      venue: "Legacy Taipei",
      event_date: taipeiDay(new Date(Date.now() + 10 * DAY)),
      live_key: liveKey(title),
    }),
  });
  if (!response.ok) throw new Error(`[tour seed] insert works → ${response.status}`);
  const [created] = (await response.json()) as Array<{ id: string }>;
  return created.id;
}

/** datetime-local 值（台北牆上時間），days 天後 20:00 */
function futureLocal(days: number): string {
  return `${taipeiDay(new Date(Date.now() + days * DAY))}T20:00`;
}

/** 記一筆 sheet：用作品選擇器搜尋並選一部 */
async function pickWork(page: Page, sheet: Locator, title: string): Promise<void> {
  await sheet.getByRole("button", { name: "搜尋作品" }).click();
  const picker = page.getByRole("dialog").filter({ has: page.getByRole("searchbox") }).last();
  await picker.getByRole("searchbox").fill(title);
  const result = picker.getByRole("button", { name: new RegExp(title) }).first();
  await expect(result).toBeVisible({ timeout: 20_000 });
  await result.click();
}

async function readTourState(page: Page, key: string): Promise<unknown> {
  return page.evaluate((storageKey) => JSON.parse(window.localStorage.getItem(storageKey) ?? "null"), key);
}

test("訪客：目錄三步 → 文章頁「開始寫」→ 完成後不再自動播", async ({ page, context }) => {
  await forceTour(context);
  await page.goto("/");
  await expect(page.locator('[data-tour="feed-first"]:visible')).toHaveCount(1);

  const first = await expectStep(page, "看完一部，說一段，就成了一篇", "步驟 1／3");
  await expectCardFits(page);
  // 焦點落在主鈕，不是「略過」
  await expect(first.getByRole("button", { name: "下一步" })).toBeFocused();
  await shot(page, "guest-1");
  await first.getByRole("button", { name: "下一步" }).click();

  const second = await expectStep(page, "讀一篇", "步驟 2／3");
  // 動作步驟也有主鈕「下一步」（拿預設焦點），略過仍在；這裡照舊真的點
  await expect(second.getByRole("button", { name: "下一步" })).toBeFocused();
  await expect(second.getByRole("button", { name: "略過" })).toBeVisible();
  await expectCardFits(page);
  await shot(page, "guest-2");
  await page.locator('[data-tour="feed-first"]:visible a').first().click();
  await expect(page).toHaveURL(/\/s\//, { timeout: NAV_TIMEOUT });

  const third = await expectStep(page, "開始寫", "步驟 3／3");
  await expect(page.locator('[data-tour="article-cta"]')).toContainText("開始寫");
  await expect(third).toContainText("登入就能記你的第一場");
  await expectCardFits(page);
  await shot(page, "guest-3");
  await third.getByRole("button", { name: "完成" }).click();
  await expect(tourCard(page)).toHaveCount(0);
  expect(await readTourState(page, "castflow.tour.guest")).toEqual({ status: "done" });

  await page.goto("/");
  await page.waitForTimeout(1500);
  await expect(tourCard(page)).toHaveCount(0);

  // 目錄頁首 ⓘ 重播
  await waitForHydration(page, '[data-tour="feed-tour-info"]');
  await page.locator('[data-tour="feed-tour-info"]').click();
  await expectStep(page, "看完一部，說一段，就成了一篇", "步驟 1／3");
});

test("登入者：排行程路線（真的點）→ 日誌接下來 → 圓鈕說明 → 完成", async ({ page, context, accounts }) => {
  accounts.trackWork(await seedLiveWork());
  await forceTour(context);
  const email = accounts.newEmail("plan");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);
  await expect(page).toHaveURL(/\/before/);

  const goal = await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7");
  await expectCardFits(page);
  await expect(goal.getByRole("button", { name: "下一步" })).toBeFocused();
  await shot(page, "member-1-goal");
  await goal.getByRole("button", { name: "下一步" }).click();

  const fork = await expectStep(page, "從哪裡開始？", "步驟 2／7");
  await expect(fork.getByRole("button", { name: "最近剛看完一部？" })).toBeVisible();
  await expectCardFits(page);
  await shot(page, "member-2-fork");
  await fork.getByRole("button", { name: "想去看點什麼？" }).click();

  await expectStep(page, "排進行程", "步驟 3／7");
  await expectCardFits(page);
  await shot(page, "plan-3a-pick");
  // 說明步驟以外的地方點不到（只有被照亮的卡可以點）
  await page.locator('[data-tour="before-plan"] button[aria-label^="排進行程"]').click();

  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await expectStep(page, "挑個時間，送出", "步驟 4／7");
  await shot(page, "plan-3b-submit");
  const when = sheet.getByLabel("日期時間");
  // sheet 步驟遮罩要讓點擊穿過（trial：只做可點檢查，不打開原生選擇器）
  await when.click({ trial: true });
  if (!(await when.inputValue())) await when.fill(futureLocal(5));
  await sheet.locator('[data-tour="log-submit"]').click();

  await expectStep(page, "排好了", "步驟 5／7");
  await expectCardFits(page);
  await shot(page, "plan-3c-journal");
  await page.locator('[data-tour="nav-journal"]:visible').click();
  await expect(page).toHaveURL(/\/journal/, { timeout: NAV_TIMEOUT });

  const upcoming = await expectStep(page, "接下來", "步驟 6／7");
  await expect(upcoming).toContainText("散場那刻會提醒你說一段");
  await expectCardFits(page);
  await shot(page, "plan-3d-upcoming");
  await upcoming.getByRole("button", { name: "下一步" }).click();

  const center = await expectStep(page, "中央圓鈕", "步驟 7／7");
  await expect(center).toContainText("按住說一段，或打字寫下來；不想寫也能只記。");
  await expectCardFits(page);
  await shot(page, "plan-3e-center");
  await center.getByRole("button", { name: "完成" }).click();
  await expect(tourCard(page)).toHaveCount(0);
  expect(await readTourState(page, `castflow.tour.member.${userId}`)).toEqual({ status: "done" });

  const planned = await rest<{ id: string }>("journal_entries", `select=id&user_id=eq.${userId}&status=eq.planned`);
  expect(planned.length).toBe(1);

  // UX-06：點「接下來」那筆 → 捲到當天明細
  await page.locator('[data-tour="journal-upcoming"] a').first().click();
  await expect(page).toHaveURL(/day=/, { timeout: NAV_TIMEOUT });
  await expect(page.getByRole("region", { name: /的紀錄$/ })).toBeInViewport();
  await shot(page, "ux06-upcoming-day");
});

test("登入者：記一筆路線 → 日誌看到這筆；「我的」重看導覽", async ({ page, context, accounts }) => {
  await forceTour(context);
  const email = accounts.newEmail("log");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);

  await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "下一步" }).click();
  await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "最近剛看完一部？" }).click();

  await expectStep(page, "記一筆", "步驟 3／7");
  await expectCardFits(page);
  await shot(page, "log-4a-center");
  await page.locator('[data-tour="center-button"]:visible button[aria-label="記一筆"]').click();

  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  await expectStep(page, "選作品", "步驟 4／7");
  await shot(page, "log-4b-work");
  // 新帳號沒有最近作品：用搜尋挑一部（作品選擇器在 sheet 裡也點得到）
  await pickWork(page, sheet, "海街日記");

  const actions = await expectStep(page, "說一段，或先記下", "步驟 5／7");
  await expect(actions).toContainText("想寫就寫，說的或打的都行；不想寫，直接記下就好。");
  await shot(page, "log-4c-actions");
  await sheet.getByRole("radio", { name: "電影院" }).click();
  await sheet.locator('[data-tour="log-submit"]').click();

  await expectStep(page, "記下了", "步驟 6／7");
  await page.locator('[data-tour="nav-journal"]:visible').click();
  await expect(page).toHaveURL(/\/journal/, { timeout: NAV_TIMEOUT });
  const latest = await expectStep(page, "日誌裡有這一筆", "步驟 7／7");
  await expectCardFits(page);
  await shot(page, "log-4d-latest");
  await latest.getByRole("button", { name: "完成" }).click();
  await expect(tourCard(page)).toHaveCount(0);

  const entries = await rest<{ id: string; work_id: string | null }>("journal_entries", `select=id,work_id&user_id=eq.${userId}`);
  expect(entries.length).toBe(1);
  if (entries[0]?.work_id) accounts.trackWork(entries[0].work_id);

  // UX-05：點有紀錄的日期格 → 捲到當天明細
  await page.locator('[data-tour="journal-today"]').click();
  await expect(page).toHaveURL(/day=/, { timeout: NAV_TIMEOUT });
  await expect(page.getByRole("region", { name: /的紀錄$/ })).toBeInViewport();
  await shot(page, "ux05-day-cell");

  // 重看導覽：「我的」卡 → 回散場之前從第一步開始
  await page.goto("/me");
  const card = page.locator('[data-tour="replay-card"]');
  await expect(card).toContainText("重看導覽");
  await shot(page, "replay-card");
  await waitForHydration(page, '[data-tour="replay-card"] button');
  await card.getByRole("button", { name: "開始導覽" }).click();
  await expect(page).toHaveURL(/\/before/, { timeout: NAV_TIMEOUT });
  await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7");
});

test("登入者：記一筆時按「現在就想說」→ 說一段頁的結尾卡", async ({ page, context, accounts }) => {
  await forceTour(context);
  await loginAsNewUser(page, accounts.newEmail("say"), "/before");

  await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "下一步" }).click();
  await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "最近剛看完一部？" }).click();
  await expectStep(page, "記一筆", "步驟 3／7");
  await page.locator('[data-tour="center-button"]:visible button[aria-label="記一筆"]').click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expectStep(page, "選作品", "步驟 4／7");
  await pickWork(page, sheet, "海街日記");
  await expectStep(page, "說一段，或先記下", "步驟 5／7");
  await sheet.locator('[data-tour="log-say-now"]').click();
  await expect(page).toHaveURL(/\/say/, { timeout: NAV_TIMEOUT });
  const last = await expectStep(page, "說的或打的都行", "步驟 6／6");
  await expectCardFits(page);
  await shot(page, "log-say");
  await last.getByRole("button", { name: "完成" }).click();
  await expect(tourCard(page)).toHaveCount(0);
});

test("登入者：第一次記下被帶去通知權限引導 → 回日誌接著看這一筆", async ({ page, context, accounts }) => {
  await forceTour(context);
  const email = accounts.newEmail("perm");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);
  // 無頭 Chrome 通知權限預設 denied；模擬一般瀏覽器第一次的 default，記下後才會去權限引導（登入後才掛，重新整理生效）
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  await page.reload();

  await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "下一步" }).click();
  await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "最近剛看完一部？" }).click();
  await expectStep(page, "記一筆", "步驟 3／7");
  await page.locator('[data-tour="center-button"]:visible button[aria-label="記一筆"]').click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expectStep(page, "選作品", "步驟 4／7");
  await pickWork(page, sheet, "海街日記");
  await expectStep(page, "說一段，或先記下", "步驟 5／7");
  await sheet.getByRole("radio", { name: "電影院" }).click();
  await sheet.locator('[data-tour="log-submit"]').click();

  await page.waitForURL(/\/notifications\/enable/);
  await expect(tourCard(page)).toHaveCount(0);
  await page.getByRole("button", { name: "先不用" }).click();
  await expect(page).toHaveURL(/\/journal/, { timeout: NAV_TIMEOUT });
  // 通知權限引導那一頁不出卡；回到日誌才接著看這一筆
  expect(await readTourState(page, `castflow.tour.member.${userId}`)).toMatchObject({ status: "active", step: "log-latest" });
  await expectStep(page, "日誌裡有這一筆", "步驟 7／7");

  const entries = await rest<{ work_id: string | null }>("journal_entries", `select=work_id&user_id=eq.${userId}`);
  expect(entries.length).toBe(1);
  if (entries[0]?.work_id) accounts.trackWork(entries[0].work_id);
});

test("略過後不再自動播；散場之前 ⓘ 可重播", async ({ page, context, accounts }) => {
  await forceTour(context);
  const email = accounts.newEmail("skip");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);

  await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "略過" }).click();
  await expect(tourCard(page)).toHaveCount(0);
  expect(await readTourState(page, `castflow.tour.member.${userId}`)).toEqual({ status: "done" });

  await page.reload();
  await page.waitForTimeout(1500);
  await expect(tourCard(page)).toHaveCount(0);

  await waitForHydration(page, '[data-tour="before-tour-info"]');
  await page.locator('[data-tour="before-tour-info"]:visible').click();
  await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7");
  await shot(page, "before-info");
});

test("沒有 force 旗標時（Playwright）不自動播", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1500);
  await expect(tourCard(page)).toHaveCount(0);
});

test.describe("觸控", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("點被照亮的中央圓鈕會真的打開記一筆", async ({ page, context, accounts }) => {
    await forceTour(context);
    const email = accounts.newEmail("touch");
    await loginAsNewUser(page, email, "/before");

    await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "下一步" }).tap();
    await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "最近剛看完一部？" }).tap();
    await expectStep(page, "記一筆", "步驟 3／7");
    await page.locator('[data-tour="center-button"]:visible button[aria-label="記一筆"]').tap();
    const sheet = page.getByRole("dialog", { name: "記一筆" });
    await expect(sheet).toBeVisible();
    await expectStep(page, "選作品", "步驟 4／7");
    await page.waitForTimeout(800);
    await expect(sheet).toBeVisible();
    await expect(tourCard(page).getByRole("button", { name: "略過" })).toBeVisible();
    await tourCard(page).getByRole("button", { name: "略過" }).tap();
    await expect(tourCard(page)).toHaveCount(0);
  });
});

/** 寬螢幕（≥1024）：沒有底部導覽與中央圓鈕，導覽要指到頂部刊頭的「日誌」「記一筆」與寬版目錄頭條（10/16 Dex 回報電腦版按下一步就結束） */
test.describe("寬螢幕 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  async function expectCardInView(page: Page): Promise<void> {
    await expect(async () => {
      const box = await tourCard(page).boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1440 + 0.5);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(900 + 0.5);
    }).toPass({ timeout: 5_000 });
  }

  test("訪客：目錄頭條照得到，三步走完", async ({ page, context }) => {
    await forceTour(context);
    await page.goto("/");
    await expect(page.locator('[data-tour="feed-first"]:visible')).toHaveCount(1);
    await (await expectStep(page, "看完一部，說一段，就成了一篇", "步驟 1／3")).getByRole("button", { name: "下一步" }).click();
    await expectStep(page, "讀一篇", "步驟 2／3");
    await expectCardInView(page);
    await page.locator('[data-tour="feed-first"]:visible a').first().click();
    await expect(page).toHaveURL(/\/s\//, { timeout: NAV_TIMEOUT });
    await expectStep(page, "開始寫", "步驟 3／3");
  });

  test("登入者：記一筆路線指到刊頭「記一筆」與「日誌」", async ({ page, context, accounts }) => {
    await forceTour(context);
    const email = accounts.newEmail("wlog");
    await loginAsNewUser(page, email, "/before");
    await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "下一步" }).click();
    await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "最近剛看完一部？" }).click();

    const center = await expectStep(page, "記一筆", "步驟 3／7");
    await expect(center).toContainText("點一下右上角的「記一筆」。");
    await expectCardInView(page);
    await page.locator('[data-tour="center-button"]:visible').click();
    const sheet = page.locator('section[role="dialog"][aria-label="記一筆"]');
    await expect(sheet).toBeVisible();
    await expectStep(page, "選作品", "步驟 4／7");
    await pickWork(page, sheet, "海街日記");
    await expectStep(page, "說一段，或先記下", "步驟 5／7");
    await sheet.getByRole("radio", { name: "電影院" }).click();
    await sheet.locator('[data-tour="log-submit"]').click();

    const logged = await expectStep(page, "記下了", "步驟 6／7");
    await expect(logged).toContainText("點「日誌」看看。");
    await expectCardInView(page);
    await page.locator('[data-tour="nav-journal"]:visible').click();
    await expect(page).toHaveURL(/\/journal/, { timeout: NAV_TIMEOUT });
    const latest = await expectStep(page, "日誌裡有這一筆", "步驟 7／7");
    await latest.getByRole("button", { name: "完成" }).click();
    await expect(tourCard(page)).toHaveCount(0);
    const userId = await accounts.userIdOf(email);
    const entries = await rest<{ work_id: string | null }>("journal_entries", `select=work_id&user_id=eq.${userId}`);
    if (entries[0]?.work_id) accounts.trackWork(entries[0].work_id);
  });

  test("登入者：略過後，散場之前的 ⓘ 在寬螢幕也看得到、可重播", async ({ page, context, accounts }) => {
    await forceTour(context);
    await loginAsNewUser(page, accounts.newEmail("winfo"), "/before");
    await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "略過" }).click();
    await expect(tourCard(page)).toHaveCount(0);
    const info = page.locator('[data-tour="before-tour-info"]:visible');
    await expect(info).toHaveCount(1);
    await waitForHydration(page, '[data-tour="before-tour-info"]');
    await info.click();
    await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7");
  });

  test("登入者：排行程路線最後一步說明刊頭的「記一筆」", async ({ page, context, accounts }) => {
    accounts.trackWork(await seedLiveWork());
    await forceTour(context);
    await loginAsNewUser(page, accounts.newEmail("wplan"), "/before");
    await (await expectStep(page, "目標：記下你的第一場散場。", "步驟 1／7")).getByRole("button", { name: "下一步" }).click();
    await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "想去看點什麼？" }).click();
    await expectStep(page, "排進行程", "步驟 3／7");
    await page.locator('[data-tour="before-plan"] button[aria-label^="排進行程"]').first().click();
    const sheet = page.locator('section[role="dialog"][aria-label="記一筆"]');
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expectStep(page, "挑個時間，送出", "步驟 4／7");
    const when = sheet.getByLabel("日期時間");
    if (!(await when.inputValue())) await when.fill(futureLocal(5));
    await sheet.locator('[data-tour="log-submit"]').click();
    const planned = await expectStep(page, "排好了", "步驟 5／7");
    await expect(planned).toContainText("點「日誌」看看。");
    await page.locator('[data-tour="nav-journal"]:visible').click();
    await expect(page).toHaveURL(/\/journal/, { timeout: NAV_TIMEOUT });
    await (await expectStep(page, "接下來", "步驟 6／7")).getByRole("button", { name: "下一步" }).click();
    const last = await expectStep(page, "記一筆", "步驟 7／7");
    await expect(last).toContainText("右上角的「記一筆」");
    await expectCardInView(page);
    await last.getByRole("button", { name: "完成" }).click();
    await expect(tourCard(page)).toHaveCount(0);
  });
});

/**
 * 只按「下一步」（Dex 10/17）：動作步驟幫你點被照亮的元素；要填資料的步驟（挑時間、選作品）不替人寫，
 * 收起記一筆、跳到日誌的圓鈕說明卡。走完日誌 0 筆、導覽狀態 done。截圖存 test-results/tour-next-*.png。
 */
for (const viewport of [
  { name: "手機 375", tag: "375", width: 375, height: 812, lastTitle: "中央圓鈕" },
  { name: "寬螢幕 1440", tag: "1440", width: 1440, height: 900, lastTitle: "記一筆" },
] as const) {
  test.describe(`只按下一步走完（${viewport.name}）`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    // 導覽卡本身也是 role=dialog（標題「記一筆」會撞名）：只認 sheet
    const logSheet = (page: Page): Locator => page.locator('section[role="dialog"][aria-label="記一筆"]');

    async function pressNext(page: Page, title: string, eyebrow: string, shotName?: string): Promise<void> {
      const card = await expectStep(page, title, eyebrow);
      const next = card.getByRole("button", { name: "下一步" });
      await expect(next).toBeFocused();
      await expect(card.getByRole("button", { name: "略過" })).toBeVisible();
      if (shotName) {
        await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/tour-next-${viewport.tag}-${shotName}.png` });
      }
      await next.click();
    }

    async function finishOnJournal(page: Page, userId: string, route: string): Promise<void> {
      await expect(page).toHaveURL(/\/journal/, { timeout: NAV_TIMEOUT });
      await expect(logSheet(page)).toHaveCount(0);
      const last = await expectStep(page, viewport.lastTitle, "步驟 7／7");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/tour-next-${viewport.tag}-${route}.png` });
      await last.getByRole("button", { name: "完成" }).click();
      await expect(tourCard(page)).toHaveCount(0);
      expect(await readTourState(page, `castflow.tour.member.${userId}`)).toEqual({ status: "done" });
      // 沒有替使用者寫任何紀錄
      const entries = await rest<{ id: string }>("journal_entries", `select=id&user_id=eq.${userId}`);
      expect(entries.length).toBe(0);
    }

    test("訪客：讀一篇 → 開始寫", async ({ page, context }) => {
      await forceTour(context);
      await page.goto("/");
      await pressNext(page, "看完一部，說一段，就成了一篇", "步驟 1／3");
      await pressNext(page, "讀一篇", "步驟 2／3");
      await expect(page).toHaveURL(/\/s\//, { timeout: NAV_TIMEOUT });
      const last = await expectStep(page, "開始寫", "步驟 3／3");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/tour-next-${viewport.tag}-guest.png` });
      await last.getByRole("button", { name: "完成" }).click();
      await expect(tourCard(page)).toHaveCount(0);
      expect(await readTourState(page, "castflow.tour.guest")).toEqual({ status: "done" });
    });

    test("登入者：排行程路線（不替人挑時間送出）", async ({ page, context, accounts }) => {
      accounts.trackWork(await seedLiveWork());
      await forceTour(context);
      const email = accounts.newEmail(`next-plan-${viewport.tag}`);
      await loginAsNewUser(page, email, "/before");
      const userId = await accounts.userIdOf(email);
      await pressNext(page, "目標：記下你的第一場散場。", "步驟 1／7");
      await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "想去看點什麼？" }).click();
      await pressNext(page, "排進行程", "步驟 3／7");
      await expect(logSheet(page)).toBeVisible({ timeout: 20_000 });
      await pressNext(page, "挑個時間，送出", "步驟 4／7", "plan-submit");
      await finishOnJournal(page, userId, "plan");
    });

    test("登入者：記一筆路線（不替人選作品記下）", async ({ page, context, accounts }) => {
      await forceTour(context);
      const email = accounts.newEmail(`next-log-${viewport.tag}`);
      await loginAsNewUser(page, email, "/before");
      const userId = await accounts.userIdOf(email);
      await pressNext(page, "目標：記下你的第一場散場。", "步驟 1／7");
      await (await expectStep(page, "從哪裡開始？", "步驟 2／7")).getByRole("button", { name: "最近剛看完一部？" }).click();
      await pressNext(page, "記一筆", "步驟 3／7", "log-center");
      await expect(logSheet(page)).toBeVisible();
      await pressNext(page, "選作品", "步驟 4／7");
      await finishOnJournal(page, userId, "log");
    });
  });
}
