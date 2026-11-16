/**
 * 記錄面體驗收尾（uxlog，10/14）：
 * - UX-12 登入頁依來源換標題（新人「用 email 開一個專欄」／回來的人「找回專欄」）；封面有「用 email 開始」
 * - UX-23 封面三步序號用阿拉伯數字（Q-58）
 * - UX-28 訪客：圓鈕不出提示泡泡、sheet 說明換成「先請你登入」；登入者照常出提示
 * - UX-24 過去月份「這個月沒有紀錄」＋補記一筆、未來月份「排一場」、本月維持
 * - UX-29「最近記過的」開 sheet 就在（預載），不停在骨架
 * - UX-27 Podcast 選了某一集，作品列下方寫哪一集
 * - UX-17「在哪看」先留一行高度；切到場外捲回第一段
 * - UX-26 同一部 2 小時內再記：sheet 內確認（不用了／再記一筆）
 * - UX-19 月曆／清單切換、日期時間欄 ≥44
 * - UX-15 品味第三題：看過／想看要選、不寫日誌、存成品味資料
 * 新互動用觸控 tap。截圖存 design/uxlog-preview-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { completePenName, loginAsNewUser, submitLoginAndFollowLink, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { expect, test, type Accounts } from "./fixtures/test";

test.use({ hasTouch: true });

const HOUR = 60 * 60 * 1000;
// 外部搜尋（TMDB）＋第一次編譯，機器忙時會超過 30 秒
const EXTERNAL_TIMEOUT_MS = 60_000;

interface WorkRow {
  id: string;
  title: string;
  podcast_show: string | null;
  episode_number: number | null;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `design/uxlog-preview-${name}.png` });
}

/** 自己種一部電影與一集有集數的 Podcast（不依賴 DB 既有資料；slug e2e- 開頭，結束由 accounts 清） */
async function seedWorks(accounts: Accounts): Promise<{ movie: WorkRow; podcast: WorkRow }> {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const [movie, podcast] = await Promise.all([
    insertWork({ kind: "movie", title: `記一筆測試電影 ${stamp}`, slug: `e2e-uxlog-movie-${stamp}` }),
    insertWork({
      kind: "podcast_episode",
      title: `記一筆測試單集 ${stamp}`,
      slug: `e2e-uxlog-pod-${stamp}`,
      podcast_show: `記一筆測試節目 ${stamp}`,
      episode_number: 12,
    }),
  ]);
  accounts.trackWork(movie.id);
  accounts.trackWork(podcast.id);
  return { movie, podcast };
}

async function insertWork(row: Record<string, unknown>): Promise<WorkRow> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/works?select=id,title,podcast_show,episode_number`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[uxlog seed] insert works → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return ((await response.json()) as WorkRow[])[0];
}

async function logViaApi(page: Page, body: Record<string, unknown>): Promise<void> {
  const response = await page.request.post("/api/journal", { data: body });
  expect(response.status()).toBe(201);
}

async function openSheet(page: Page): Promise<Locator> {
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).tap();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function closeSheet(page: Page, sheet: Locator): Promise<void> {
  await sheet.getByRole("button", { name: "關閉" }).tap();
  await expect(sheet).toBeHidden();
}

test("UX-12 登入頁依來源換標題；封面有「用 email 開始」", async ({ page }) => {
  await page.goto("/login");
  const start = page.getByRole("link", { name: /用 email 開始/ });
  await expect(start).toBeVisible();
  await expect(page.getByRole("link", { name: /用 email 找回來/ })).toBeVisible();
  // UX-23（Q-58）：封面三步的序號是阿拉伯數字
  const steps = page.getByRole("list", { name: "怎麼用" }).getByRole("listitem");
  await expect(steps.locator("span:first-child")).toHaveText(["1", "2", "3"]);
  await shot(page, "welcome");
  await start.tap();
  await expect(page).toHaveURL(/\/login\?step=start$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("用 email 開一個專欄");
  await expect(page.getByText("開一個專欄", { exact: true })).toBeVisible();
  await shot(page, "login-start");

  // 從我的、說一段、記一筆被擋下來：新人語氣
  for (const next of ["/me", "/say?resume=1", "/journal/new?resume=1"]) {
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("用 email 開一個專欄");
  }
  // 回來的人：找回
  await page.goto("/login?step=mail");
  await expect(page.getByText("找回專欄", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("用 email 收一個連結");
});

test("UX-28 訪客：圓鈕不出提示泡泡、sheet 說明換成先登入", async ({ page }) => {
  const boot = page.waitForResponse((response) => response.url().endsWith("/api/journal/sheet"));
  await page.goto("/");
  expect((await boot).status()).toBe(401);
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.waitForTimeout(500);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await shot(page, "guest-home");

  const sheet = await openSheet(page);
  await expect(sheet.getByText("按下去會先請你登入，剛剛填的會留著。")).toBeVisible();
  await expect(sheet.getByText(/明天中午/)).toHaveCount(0);
  await shot(page, "guest-sheet");
});

test("日誌與記一筆：空月份文案、預載最近作品、集數、在哪看留高度、場外捲回、同作品再記確認", async ({ page, accounts }) => {
  test.setTimeout(300_000);
  const { movie, podcast } = await seedWorks(accounts);
  const email = accounts.newEmail("log");
  await loginAsNewUser(page, email, "/journal");
  await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  const userId = await accounts.userIdOf(email);

  // 本月空：維持原文案；登入者照常出圓鈕提示（UX-28 只擋訪客）
  await expect(page.getByText("這個月的第一筆，")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("按住");

  // UX-24 過去月份：沒有紀錄＋補記一筆（不講排行程）
  await page.getByRole("link", { name: "上個月" }).tap();
  await expect(page.getByText("這個月沒有紀錄。")).toBeVisible();
  await expect(page.getByText(/從今晚開始/)).toHaveCount(0);
  await shot(page, "journal-past-empty");
  await waitForHydration(page, "section button.self-start");
  await page.getByRole("button", { name: "補記一筆" }).tap();
  let sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet.getByRole("radio", { name: "選日期時間" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByRole("button", { name: "選一個日期時間" })).toBeVisible();
  await expect(sheet.getByText("當天早上會提醒你。")).toHaveCount(0);
  // UX-19 日期時間欄 ≥44
  expect((await sheet.getByLabel("日期時間").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await closeSheet(page, sheet);

  // 未來月份：排一場
  await page.goto("/journal");
  await page.getByRole("link", { name: "下個月" }).tap();
  await expect(page.getByText("這個月還空著，")).toBeVisible();
  await waitForHydration(page, "section button.self-start");
  await page.getByRole("button", { name: "排一場" }).tap();
  sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet.getByRole("button", { name: "選一個日期時間" })).toBeVisible();
  await expect(sheet.getByText("當天早上會提醒你。")).toBeVisible();
  await shot(page, "journal-future-sheet");
  await closeSheet(page, sheet);

  // 種兩筆，讓「最近記過的」有電影與 Podcast
  await logViaApi(page, { workId: movie.id, experiencedAt: new Date(Date.now() - 30 * HOUR).toISOString(), venue: "home" });
  await logViaApi(page, { workId: podcast.id, experiencedAt: new Date(Date.now() - 50 * HOUR).toISOString(), venue: "commute" });

  // UX-29：殼一掛上就預載，開 sheet 時作品已在（不等骨架）
  const boot = page.waitForResponse((response) => response.url().endsWith("/api/journal/sheet") && response.status() === 200);
  await page.goto("/journal");
  await boot;
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  // UX-19 月曆／清單切換 ≥44 寬
  for (const name of ["月曆", "清單"]) {
    const box = await page.getByRole("radio", { name }).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "記一筆", exact: true }).tap();
  sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet.getByRole("radio", { name: movie.title })).toBeVisible({ timeout: 1_000 });
  await shot(page, "sheet-recent");

  // UX-27 Podcast：作品列下方寫哪一集
  await sheet.getByRole("radio", { name: new RegExp(podcast.podcast_show ?? "") }).tap();
  await expect(sheet.getByText("這一集")).toBeVisible();
  await expect(sheet.getByText(`第 ${podcast.episode_number} 集・${podcast.title}`)).toBeVisible();
  await shot(page, "sheet-podcast");

  // UX-17：選電影，「在哪看」那一行先留 44 高
  await sheet.getByRole("radio", { name: movie.title }).tap();
  const extra = sheet.getByTestId("log-work-extra");
  expect((await extra.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shot(page, "sheet-movie");

  // UX-17：捲到下面選「音樂祭/演出」→ 捲回第一段，場外表單看得到
  const scroller = sheet.locator("div.overflow-y-auto").first();
  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await sheet.getByRole("radio", { name: "音樂祭/演出" }).tap();
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop), { timeout: 5_000 }).toBe(0);
  await expect(sheet.getByPlaceholder("演出名或展覽名")).toBeInViewport();
  await shot(page, "sheet-live-top");

  // UX-26：2 小時內再記同一部 → sheet 內確認；不用了＝不記、收起
  await sheet.getByRole("radio", { name: "電影院" }).tap();
  await sheet.getByRole("radio", { name: movie.title }).tap();
  await sheet.getByRole("button", { name: "記下了" }).tap();
  const confirm = sheet.getByRole("alertdialog", { name: "再記一筆確認" });
  await expect(confirm).toContainText(`記過《${movie.title}》了，要再記一筆嗎？`);
  await expect(sheet.getByRole("button", { name: "記下了" })).toBeHidden();
  await shot(page, "sheet-repeat");
  await confirm.getByRole("button", { name: "不用了" }).tap();
  await expect(sheet).toBeHidden();
  const movieEntries = () => rest<{ id: string }>("journal_entries", `select=id&user_id=eq.${userId}&work_id=eq.${movie.id}`);
  expect(await movieEntries()).toHaveLength(1);

  // 再來一次，這次「再記一筆」→ 蓋章、多一筆
  sheet = await openSheet(page);
  await sheet.getByRole("radio", { name: movie.title }).tap();
  await sheet.getByRole("radio", { name: "電影院" }).tap();
  await sheet.getByRole("button", { name: "記下了" }).tap();
  await sheet.getByRole("alertdialog", { name: "再記一筆確認" }).getByRole("button", { name: "再記一筆" }).tap();
  await expect(page.getByText("散場誌・日誌")).toBeVisible();
  await expect.poll(async () => (await movieEntries()).length).toBe(2);
});

test("UX-15 品味第三題：看過／想看要選，不寫日誌、存成品味資料", async ({ page, accounts }) => {
  test.setTimeout(240_000);
  const email = accounts.newEmail("taste");
  await page.goto(`/login?next=${encodeURIComponent("/journal")}`);
  await submitLoginAndFollowLink(page, email);
  await completePenName(page, { stayOnTaste: true });
  await expect(page).toHaveURL(/\/onboarding\/taste/);
  const userId = await accounts.userIdOf(email);
  await waitForHydration(page, 'button[role="checkbox"]');
  await page.getByRole("button", { name: "下一題" }).tap();
  await page.getByRole("button", { name: "下一題" }).tap();
  await expect(page.getByText("品味・3/3")).toBeVisible();
  await expect(page.getByText("不會記進日誌，也不會提醒你")).toBeVisible();

  // 挑一部（作品選擇面板真打外部搜尋）
  await page.getByRole("button", { name: /挑一部（0\/3）/ }).tap();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox", { name: "搜尋作品" }).fill("海街日記");
  const first = dialog.getByRole("button").filter({ hasText: "海街日記" }).first();
  await expect(first).toBeVisible({ timeout: EXTERNAL_TIMEOUT_MS });
  const created = page.waitForResponse((response) => response.url().endsWith("/api/works") && response.request().method() === "POST");
  await first.tap();
  const body = (await (await created).json()) as { data?: { work?: { id: string; title: string; created_at: string } } };
  const work = body.data?.work;
  if (!work) throw new Error("[uxlog e2e] 選作品沒有拿到作品");
  if (Date.now() - new Date(work.created_at).getTime() < 60_000) accounts.trackWork(work.id);

  // 沒預設看過：兩個都沒選，按完成會請他選
  const toggle = page.getByRole("radiogroup", { name: `《${work.title}》看過還是想看` });
  await expect(toggle.getByRole("radio", { name: "看過" })).toHaveAttribute("aria-checked", "false");
  await expect(toggle.getByRole("radio", { name: "想看" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "完成" }).tap();
  // Next 的路由播報器也是 role=alert，用文字找
  const unanswered = page.getByText("每一部都選一下看過或想看。");
  await expect(unanswered).toBeVisible();
  await shot(page, "taste-unanswered");
  await toggle.getByRole("radio", { name: "看過" }).tap();
  await expect(unanswered).toHaveCount(0);
  await page.getByRole("button", { name: "完成" }).tap();
  await expect(page).toHaveURL(/\/journal$/, { timeout: 45_000 });

  // 不寫日誌（沒有假日期、沒有提醒）；存成品味資料
  expect(await rest("journal_entries", `select=id&user_id=eq.${userId}`)).toHaveLength(0);
  const [stored] = await rest<{ value: { picks: Array<{ workId: string; seen: boolean }> } }>(
    "settings",
    `select=value&key=eq.taste_picks:${userId}`,
  );
  expect(stored.value.picks).toEqual([expect.objectContaining({ workId: work.id, seen: true })]);
  await expect(page.getByText("這個月的第一筆，")).toBeVisible();
});
