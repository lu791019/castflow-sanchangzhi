/**
 * 作品選擇器（說一段頁）：真打外部 API（TMDB / iTunes + RSS），外部失敗就讓測試失敗，不 skip。
 * 匿名即可使用（搜尋與從搜尋結果建立作品不需登入）。
 * 「本週熱門」要真榜單：本檔期間請外部服務路由把上映清單與榜單改真打（其他 spec 預設只給假 server）。
 */

import type { Page, Response } from "@playwright/test";
import { waitForHydration } from "./fixtures/auth";
import { useRealTrending } from "./fixtures/mock-router";
import { expect, test, type Accounts } from "./fixtures/test";

const EXTERNAL_TIMEOUT_MS = 30_000;

test.beforeAll(async () => {
  await useRealTrending(true);
});

test.afterAll(async () => {
  await useRealTrending(false);
});

async function openPicker(page: Page) {
  await page.goto("/say");
  await waitForHydration(page, 'button[aria-label="按住說話"]');
  await page.getByRole("button", { name: "選作品" }).click();
  const dialog = page.getByRole("dialog", { name: "這篇在說哪一部？" });
  await expect(dialog).toBeVisible();
  return dialog;
}

interface CreatedWorkBody {
  data?: { work?: { id?: string; created_at?: string } };
}

/** 選定作品會 POST /api/works（建立或取回）；這次測試期間才建立的作品登記清理，既有作品不動 */
async function trackIfCreatedDuringTest(response: Response, accounts: Accounts, startedAt: number): Promise<void> {
  const body = (await response.json()) as CreatedWorkBody;
  const work = body.data?.work;
  if (work?.id && work.created_at && new Date(work.created_at).getTime() >= startedAt - 5_000) {
    accounts.trackWork(work.id);
  }
}

test.describe("作品選擇器", () => {
  test("搜電影「海街日記」選第一筆 → 作品卡變成《海街日記》", async ({ page, accounts }) => {
    const startedAt = Date.now();
    const dialog = await openPicker(page);

    await dialog.getByRole("searchbox", { name: "搜尋作品" }).fill("海街日記");
    const firstResult = dialog.getByRole("button").filter({ hasText: "海街日記" }).first();
    await expect(firstResult).toBeVisible({ timeout: EXTERNAL_TIMEOUT_MS });

    const created = page.waitForResponse(
      (response) => response.url().endsWith("/api/works") && response.request().method() === "POST",
    );
    await firstResult.click();
    const response = await created;
    expect(response.ok()).toBe(true);
    await trackIfCreatedDuringTest(response, accounts, startedAt);

    await expect(dialog).toBeHidden();
    await expect(page.getByText("剛看完《海街日記》")).toBeVisible();
    await expect(page.getByRole("button", { name: "更換" })).toBeVisible();
  });

  test("還沒打字就有「本週熱門」：電影分正在上映／即將上映，Podcast 列榜單節目", async ({ page }) => {
    const dialog = await openPicker(page);
    const nowPlaying = dialog.getByRole("region", { name: "正在上映" });
    await expect(nowPlaying).toBeVisible({ timeout: EXTERNAL_TIMEOUT_MS });
    expect(await nowPlaying.getByRole("button").count()).toBeGreaterThan(3);
    await expect(dialog.getByRole("region", { name: "即將上映" })).toBeVisible();

    await dialog.getByRole("button", { name: "Podcast" }).click();
    const top = dialog.getByRole("region", { name: "本週熱門" });
    await expect(top).toBeVisible({ timeout: EXTERNAL_TIMEOUT_MS });
    // 載入中的骨架也叫「本週熱門」：等榜單列真的出現
    await expect
      .poll(() => top.getByRole("button").filter({ hasText: "選集數" }).count(), { timeout: EXTERNAL_TIMEOUT_MS })
      .toBeGreaterThan(10);

    // 打字就切回搜尋結果，熱門收起
    await dialog.getByRole("searchbox", { name: "搜尋作品" }).fill("股癌");
    await expect(top).toBeHidden();
  });

  test("Podcast 搜「股癌」→ 選節目 → 出現集數列表", async ({ page }) => {
    const dialog = await openPicker(page);

    await dialog.getByRole("button", { name: "Podcast" }).click();
    await expect(dialog.getByRole("button", { name: "Podcast" })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByRole("searchbox", { name: "搜尋作品" }).fill("股癌");

    const show = dialog.getByRole("button").filter({ hasText: "股癌" }).filter({ hasText: "選集數" }).first();
    await expect(show).toBeVisible({ timeout: EXTERNAL_TIMEOUT_MS });
    await show.click();

    const breadcrumb = dialog.getByRole("navigation", { name: "位置" });
    await expect(breadcrumb).toContainText("選集數");
    await expect(dialog.getByLabel("載入集數中")).toBeHidden({ timeout: EXTERNAL_TIMEOUT_MS });
    await expect(dialog.getByRole("button", { name: "再試一次" })).toHaveCount(0);

    const episodes = dialog.locator('nav[aria-label="位置"] ~ button');
    await expect(episodes.first()).toBeVisible();
    expect(await episodes.count()).toBeGreaterThan(3);
  });
});
