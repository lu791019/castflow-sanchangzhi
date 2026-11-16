/**
 * P3 作者專欄名：
 * - 設定頁「專欄名」就地編輯 → 索引作者分頁、搜尋作者列、作者專欄頁、我的頁刊頭都顯示
 * - 超過 20 字不能存；清空 → 各處不顯示那一行（不給預設名）
 * 只跑本檔：E2E_PORT=3056 E2E_EMAIL_PREFIX=e2e+p3colname- （不跑 globalSetup）
 * E2E_SHOTS=1 時另存 375 截圖到 design/p3colname-preview-*.png
 */

import type { Page } from "@playwright/test";
import { authorPath } from "../src/lib/authors/path";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { createArticle } from "./fixtures/p3idx-seed";
import { expect, test } from "./fixtures/test";

function token(): string {
  return `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `design/p3colname-preview-${name}.png` });
}

async function editColumnName(page: Page, value: string): Promise<void> {
  await page.goto("/me/settings");
  await waitForHydration(page, '[data-testid="column-name-value"]');
  await page.getByRole("button", { name: /^(改|取一個)$/ }).click();
  const input = page.getByRole("textbox", { name: "專欄名" });
  await input.fill(value);
}

test("專欄名：設定 → 索引、搜尋、作者頁、我的頁顯示；清空 → 都不顯示", async ({ page, accounts }) => {
  const tok = token();
  const column = `公車上的散場${tok}`;
  const email = accounts.newEmail("writer");
  const penName = await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  await createArticle(userId, { title: `看完電影${tok}，我傳了訊息給姊姊`, publishedAt: "2026-10-08T12:00:00Z" });
  await createArticle(userId, { title: `匿名的心事${tok}`, byline: "anonymous" });

  // 還沒取：設定頁顯示「還沒取」，索引作者列沒有專欄名
  await page.goto("/me/settings");
  await expect(page.getByTestId("column-name-value")).toHaveText("還沒取");
  await page.goto("/catalog?tab=authors");
  const row = page.locator(`main a[href="${authorPath(penName)}"]`);
  await expect(row).toBeVisible();
  await expect(row.getByTestId("author-column-name")).toHaveCount(0);

  // 超過 20 字：計數變紅、不能存
  await editColumnName(page, "字".repeat(21));
  await expect(page.getByText("21/20")).toBeVisible();
  await expect(page.getByRole("button", { name: "存檔" })).toBeDisabled();

  // 頭尾空白、貼上的「專欄｜」前綴會被拿掉
  await page.getByRole("textbox", { name: "專欄名" }).fill(`  專欄｜${column}  `);
  await shot(page, "settings-edit");
  await page.getByRole("button", { name: "存檔" }).click();
  await expect(page.getByTestId("column-name-value")).toHaveText(column);
  await page.reload();
  await expect(page.getByTestId("column-name-value")).toHaveText(column);
  await shot(page, "settings-saved");

  await page.goto("/catalog?tab=authors");
  await expect(row.getByTestId("author-column-name")).toHaveText(column);
  await row.scrollIntoViewIfNeeded();
  await shot(page, "catalog-authors");

  await page.goto(`/catalog?q=${encodeURIComponent(penName)}`);
  await expect(page.locator(`main a[href="${authorPath(penName)}"]`)).toContainText(`${column}・`);
  await shot(page, "search");

  await page.goto(authorPath(penName));
  await expect(page.getByTestId("author-column-label")).toHaveText(`專欄｜${column}`);
  await expect(page.getByText(`匿名的心事${tok}`)).toHaveCount(0);
  await shot(page, "author-page");

  await page.goto("/me");
  await expect(page.getByText(`專欄｜${column}`)).toBeVisible();
  await shot(page, "me");

  // 清空 → 不取：各處不顯示專欄名那一行
  await editColumnName(page, "   ");
  await page.getByRole("button", { name: "存檔" }).click();
  await expect(page.getByTestId("column-name-value")).toHaveText("還沒取");
  await shot(page, "settings-cleared");

  await page.goto("/catalog?tab=authors");
  await expect(row).toBeVisible();
  await expect(row.getByTestId("author-column-name")).toHaveCount(0);
  await expect(page.getByText(column)).toHaveCount(0);

  await page.goto(authorPath(penName));
  await expect(page.getByTestId("author-column-label")).toHaveText("專欄");
  await shot(page, "author-page-cleared");

  await page.goto("/me");
  await expect(page.getByText(column)).toHaveCount(0);
});

test("未登入開設定頁 → 導去登入，看不到專欄名編輯列", async ({ page }) => {
  // 未登入開設定頁 → 導去登入，不會看到可編輯的列
  await page.goto("/me/settings");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("column-name-value")).toHaveCount(0);
});
