/**
 * 散場之前（首屏，10/13 grill Q-34）：登入落地 /before → 三區塊；
 * 社群場刊（未來 10 天的演出）出現在「這週上映・開演・開展」→ 卡片「排進行程」開 sheet 預填作品與選日期時間 → 排好後出現在「你排好的」。
 * BEFORE_SHOTS=1 時輸出 375 寬截圖到 design/before-preview-*.png。
 */

import type { Page } from "@playwright/test";
import { liveKey } from "../src/lib/venue/name";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { expect, test } from "./fixtures/test";

const SHOTS = process.env.BEFORE_SHOTS === "1";
const DAY = 24 * 60 * 60 * 1000;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(350);
  const viewport = page.viewportSize();
  if (viewport) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `design/before-preview-${name}.png` });
  if (viewport) await page.setViewportSize(viewport);
}

/** 台北日曆日 YYYY-MM-DD */
function taipeiDay(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function seedLiveWork(title: string, eventDate: string): Promise<{ id: string }> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/works`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      kind: "live",
      title,
      slug: `e2e-before-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      venue: "Legacy Taipei",
      event_date: eventDate,
      live_key: liveKey(title),
    }),
  });
  if (!response.ok) throw new Error(`[before seed] insert works → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [created] = (await response.json()) as Array<{ id: string }>;
  return created;
}

test("登入落地散場之前 → 場外卡片排進行程 → 你排好的", async ({ page, accounts }) => {
  const eventDate = taipeiDay(new Date(Date.now() + 10 * DAY));
  const title = `散場測試巡迴 ${Date.now().toString(36)}`;
  const work = await seedLiveWork(title, eventDate);
  accounts.trackWork(work.id);

  const email = accounts.newEmail("land");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);

  // 登入者裸 `/` → 散場之前；導覽第一格「散場之前」選中
  await page.goto("/");
  await expect(page).toHaveURL(/\/before$/);
  const nav = page.getByRole("navigation", { name: "主要導覽" }).first();
  await expect(nav.getByRole("link").first()).toHaveText("散場之前");
  await expect(nav.getByRole("link", { name: "散場之前" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "作品" })).toHaveCount(0);

  // 三區塊
  await expect(page.getByRole("heading", { level: 1, name: /有什麼值得出門/ })).toBeVisible();
  const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
  const plans = page.getByRole("region", { name: "你排好的" });
  await expect(thisWeek).toBeVisible();
  await expect(plans).toBeVisible();
  await expect(page.getByRole("region", { name: "有人說了" })).toBeVisible();
  await expect(plans.getByText("這週還沒有排")).toBeVisible();

  // ① 出現社群場刊：演出・場地・日期
  const card = thisWeek.getByRole("article").filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByText(`演出・Legacy Taipei・${eventDate.slice(5, 7)}.${eventDate.slice(8, 10)}`)).toBeVisible();
  await shot(page, "filled");

  // 排進行程：sheet 開啟，場外名稱／場地／日期已填、選日期時間已切換且帶當天晚上
  await waitForHydration(page, `button[aria-label="排進行程：${title}"]`);
  await card.getByRole("button", { name: `排進行程：${title}` }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "演出名或展覽名" })).toHaveValue(title);
  await expect(sheet.getByRole("radio", { name: "音樂祭/演出" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByRole("radio", { name: "選日期時間" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByLabel("日期時間")).toHaveValue(`${eventDate}T19:30`);
  await shot(page, "sheet");

  await sheet.getByRole("button", { name: "排進行程" }).click();
  await expect(page.getByText("散場誌・計畫")).toBeVisible();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  // 第一次用介面記下會先帶去權限引導
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 5_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/notifications"), { timeout: 30_000 });
  }

  // DB：計畫中，歸回同一本場刊
  const entries = await rest<{ status: string; work_id: string }>(
    "journal_entries",
    `select=status,work_id&user_id=eq.${userId}`,
  );
  expect(entries).toEqual([{ status: "planned", work_id: work.id }]);

  // ② 你排好的出現這一場
  await page.goto("/before");
  await expect(page.getByRole("region", { name: "你排好的" }).getByText(title)).toBeVisible();
});
