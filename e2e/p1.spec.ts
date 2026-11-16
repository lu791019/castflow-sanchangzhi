/**
 * P1 視聽日誌與通知：記一筆（中央圓鈕點一下）→ 權限引導 → 日誌月曆／展開某天／清單 → 收件匣說說看／只記不說。
 * 真走 magic link 登入；紀錄由 UI 與 /api/journal 建立，提醒通知以 service role 寫入（模擬 worker）。
 * P1_SHOTS=1 時順便輸出 375 寬截圖到 design/p1-preview-*.png。
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { expect, test, useFakeMicrophone } from "./fixtures/test";
import { seedTestWork } from "./fixtures/works-seed";

const SHOTS = process.env.P1_SHOTS === "1";
const HOUR = 60 * 60 * 1000;

/** fullPage 時把視窗撐到整頁高再截（固定的底部導航才會在最下面，不會疊在頁中） */
async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(350);
  const viewport = page.viewportSize();
  if (fullPage && viewport) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `design/p1-preview-${name}.png` });
  if (fullPage && viewport) await page.setViewportSize(viewport);
}

async function insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[e2e p1] insert ${table} → ${response.status} ${await response.text()}`);
  return ((await response.json()) as T[])[0];
}

/**
 * 提醒用 upsert：雲端本機 worker（launchd）也會掃到測試帳號的紀錄、先建同一則 say_reminder（journal_entry_id＋kind 唯一），
 * 這裡蓋成測試要的內容，不因為 worker 先建就撞唯一鍵。
 */
async function upsertNotification(row: Record<string, unknown>): Promise<void> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/notifications?on_conflict=journal_entry_id,kind`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[e2e p1] upsert notifications → ${response.status} ${await response.text()}`);
}

async function patch(table: string, query: string, row: Record<string, unknown>): Promise<void> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[e2e p1] patch ${table} → ${response.status} ${await response.text()}`);
}

async function logViaApi(page: Page, body: Record<string, unknown>): Promise<string> {
  const response = await page.request.post("/api/journal", { data: body });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { entry: { id: string } }).entry.id;
}

test("記一筆 → 權限引導 → 日誌 → 收件匣", async ({ page, accounts }) => {
  const movie = await seedTestWork(accounts, "p1");
  const podcast = await seedTestWork(accounts, "p1-pod", { kind: "podcast_episode", podcastShow: "測試節目 p1", episodeNumber: 3 });

  // 無頭 Chrome 的通知權限預設是 denied；模擬一般瀏覽器第一次的 default，才會出現權限引導
  await page.context().addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  const email = accounts.newEmail("p1");
  await loginAsNewUser(page, email, "/journal");
  await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  const userId = await accounts.userIdOf(email);

  // D：空月份；第一次打開出現圓鈕提示
  await expect(page.getByText("這個月的第一筆，")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("按住");
  await shot(page, "nav-hint", false);
  await shot(page, "journal-D-empty");

  // 收件匣 B：空
  await page.goto("/notifications");
  await expect(page.getByText("沒有需要回覆的提醒。")).toBeVisible();
  await shot(page, "inbox-B-empty", false);

  // 先用 API 記一筆，讓「最近記過的」有作品
  const now = Date.now();
  await logViaApi(page, { workId: movie.id, experiencedAt: new Date(now - 26 * HOUR).toISOString(), venue: "home" });

  // 記一筆：中央圓鈕點一下 → sheet A
  await page.goto("/journal");
  const center = page.getByRole("button", { name: "記一筆", exact: true });
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await center.click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "選作品與在哪裡" })).toBeVisible();
  await expect(sheet.getByRole("radio", { name: movie.title })).toBeVisible();
  await shot(page, "log-A-open", false);

  // B：選作品、場域 → 可送出
  await sheet.getByRole("radio", { name: movie.title }).click();
  await sheet.getByRole("radio", { name: "電影院" }).click();
  await sheet.getByRole("radio", { name: "昨天" }).click();
  await expect(sheet.getByRole("button", { name: "記下了" })).toBeVisible();
  await shot(page, "log-B-ready", false);

  // 同一部剛用 API 記過（2 小時內）：sheet 內先確認一次（UX-26）
  await sheet.getByRole("button", { name: "記下了" }).click();
  await sheet.getByRole("alertdialog", { name: "再記一筆確認" }).getByRole("button", { name: "再記一筆" }).click();

  // C：蓋章 → 第一次記下後帶去權限引導
  await expect(page.getByText("散場誌・日誌")).toBeVisible();
  await shot(page, "log-C-stamp", false);
  await page.waitForURL(/\/notifications\/enable\?entry=/);
  await expect(page.getByRole("heading", { name: /要我們問你一聲嗎/ })).toBeVisible();
  await expect(page.getByText("你的第一筆")).toBeVisible();
  await shot(page, "permission", false);
  await page.getByRole("button", { name: "先不用" }).click();
  await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });

  // DB：兩筆紀錄都屬於這個使用者
  const entries = await rest<{ id: string; venue: string; status: string }>(
    "journal_entries",
    `select=id,venue,status&user_id=eq.${userId}&order=experienced_at.asc`,
  );
  expect(entries).toHaveLength(2);
  expect(entries.map((e) => e.venue).sort()).toEqual(["cinema", "home"]);

  // 再補幾筆：Podcast、只記不說、說成了文章（文章以 service role 建草稿集數並連上）
  if (podcast) {
    await logViaApi(page, { workId: podcast.id, experiencedAt: new Date(now - 50 * HOUR).toISOString(), venue: "commute" });
  }
  const skippedId = await logViaApi(page, { workTitle: "光的抄寫・攝影展", experiencedAt: new Date(now - 74 * HOUR).toISOString(), venue: "exhibition" });
  await page.request.post(`/api/journal/${skippedId}/skip`);
  const skippedAskedAt = new Date(now - 54 * HOUR).toISOString();
  // 月曆「今天」格以台北日曆日分組：剛過午夜時 3 小時前已是前一格，夾在今天零點之後
  const saidAt = Math.max(now - 3 * HOUR, new Date(now).setHours(0, 0, 0, 0));
  const saidId = await logViaApi(page, { workId: movie.id, experiencedAt: new Date(saidAt).toISOString(), venue: "cinema" });
  const episode = await insert<{ id: string }>("episodes", {
    title: `E2E P1 ${movie.title}`,
    audio_url: "",
    status: "transcribed",
    user_id: userId,
    source: "text",
    created_at: new Date(saidAt + 18 * 60 * 1000).toISOString(),
  });
  await patch("journal_entries", `id=eq.${saidId}`, { status: "said", episode_id: episode.id });

  // A：月曆 + 還沒說的
  await page.goto("/journal");
  await expect(page.getByRole("heading", { name: "還沒說的" })).toBeVisible();
  await shot(page, "journal-A-calendar");

  // B：點今天展開
  const today = page.getByRole("link", { name: /今天/ });
  await today.click();
  await expect(page.getByText("說成了一篇 →")).toBeVisible();
  await expect(page.getByText(/在電影院看完・散場後 18 分鐘寫的/)).toBeVisible();
  await shot(page, "journal-B-day");

  // C：清單
  await page.getByRole("radio", { name: "清單" }).click();
  await expect(page.getByText(/一日之前/)).toBeVisible();
  await expect(page.getByText("只記不說").first()).toBeVisible();
  await shot(page, "journal-C-list");

  // 收件匣 A：模擬 worker 建兩則提醒（一則未讀、一則已讀）
  const pending = entries.find((e) => e.venue === "home");
  if (!pending) throw new Error("[e2e] 找不到剛記的紀錄");
  await upsertNotification({ user_id: userId, journal_entry_id: pending.id, kind: "say_reminder", title: "舊標題", body: "舊內文", read_at: null });
  await upsertNotification({
    user_id: userId,
    journal_entry_id: skippedId,
    kind: "say_reminder",
    title: "舊標題",
    body: "舊內文",
    created_at: skippedAskedAt,
    read_at: skippedAskedAt,
  });

  // 底部導航「我的」紅點、日誌刊頭鈴鐺
  await page.goto("/journal");
  await expect(page.getByRole("link", { name: "收件匣，1 則未讀" })).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByText("1 則未讀")).toBeVisible();
  await expect(page.getByText(/現在想說說嗎？/)).toBeVisible();
  await shot(page, "inbox-A");

  // 說說看 → 標已讀 → 進說一段（已帶入作品）
  await page.getByRole("button", { name: "說說看" }).click();
  await page.waitForURL(new RegExp(`/say\\?journal=${pending.id}$`));
  const [read] = await rest<{ read_at: string | null }>("notifications", `select=read_at&journal_entry_id=eq.${pending.id}`);
  expect(read.read_at).not.toBeNull();

  // 日誌「只記不說」
  await page.goto("/journal");
  const before = await rest<{ status: string }>("journal_entries", `select=status&id=eq.${pending.id}`);
  expect(before[0].status).toBe("recorded");
  await page.goto(`/journal?day=${new Date(now - 26 * HOUR + 8 * HOUR).toISOString().slice(0, 10)}`);
  // 同一天可能還有別筆未說（凌晨跑時「昨天」也落在這天），只點這一筆的按鈕
  await page.locator(`a[href="/say?journal=${pending.id}"]`).locator("xpath=..").getByRole("button", { name: "只記不說" }).click();
  await expect
    .poll(async () => (await rest<{ status: string }>("journal_entries", `select=status&id=eq.${pending.id}`))[0].status)
    .toBe("skipped");
});

test("中央圓鈕按住 → 說一段；/journal/new 可直接連結", async ({ page, context, accounts }) => {
  await useFakeMicrophone(context);
  const email = accounts.newEmail("p1-press");
  await loginAsNewUser(page, email, "/journal/new");
  await expect(page.getByRole("dialog", { name: "記一筆" })).toBeVisible();
  await page.getByRole("button", { name: "關閉" }).click();
  await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });

  await waitForHydration(page, 'button[aria-label="記一筆"]');
  const box = await page.getByRole("button", { name: "記一筆", exact: true }).boundingBox();
  if (!box) throw new Error("[e2e] 找不到中央圓鈕");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByText("繼續按住…")).toBeVisible();
  await shot(page, "nav-holding", false);
  // P4 〇一b：滿圈即切到說一段，不必放開。「開始說」只停留 SWELL_MS 就換頁，
  // 上一張截圖的耗時會吃掉這段，不斷言這個瞬間，只驗最後換到 /say
  await page.waitForURL(/\/say$/);
  // 到了說一段已經在錄（不必再按一次）；同一個手勢放開就完成
  await expect(page.getByText("放開就完成 · 移開取消")).toBeVisible();
  await page.waitForTimeout(3_500);
  await page.mouse.up();
  const userId = await accounts.userIdOf(email);
  await expect
    .poll(async () => (await rest<{ audio_url: string | null }>("episodes", `select=audio_url&user_id=eq.${userId}`)).length, {
      timeout: 30_000,
    })
    .toBe(1);
});

test("中央圓鈕按滿後先放開 → 說一段照樣開始錄，點一下完成", async ({ page, context, accounts }) => {
  await useFakeMicrophone(context);
  const email = accounts.newEmail("p1-latch");
  await loginAsNewUser(page, email, "/journal");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  const box = await page.getByRole("button", { name: "記一筆", exact: true }).boundingBox();
  if (!box) throw new Error("[e2e] 找不到中央圓鈕");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 滿圈 400ms 之後、換頁（再 280ms）之前放開
  await page.waitForTimeout(500);
  await page.mouse.up();
  await page.waitForURL(/\/say$/);

  const finish = page.getByRole("button", { name: "完成錄音" });
  await expect(finish).toBeVisible();
  await expect(page.getByText("點一下完成")).toBeVisible();
  await page.waitForTimeout(3_500);
  await finish.click();
  const userId = await accounts.userIdOf(email);
  await expect
    .poll(async () => (await rest("episodes", `select=id&user_id=eq.${userId}`)).length, { timeout: 30_000 })
    .toBe(1);
});

test("iPhone 非主畫面 → 加入主畫面引導", async ({ browser, accounts }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  await context.addInitScript(() => {
    // iPhone Safari 分頁模式沒有 PushManager
    delete (window as unknown as { PushManager?: unknown }).PushManager;
  });
  const page = await context.newPage();
  try {
    await loginAsNewUser(page, accounts.newEmail("p1-ios"), "/notifications/enable");
    await expect(page.getByRole("heading", { name: /先把散場誌放到主畫面/ })).toBeVisible();
    await shot(page, "iphone-home-screen", false);
    await page.getByRole("button", { name: "以後再說" }).click();
    await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  } finally {
    await context.close();
  }
});
