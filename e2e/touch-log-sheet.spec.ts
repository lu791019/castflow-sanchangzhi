/**
 * 觸控按中央圓鈕「記一筆」：sheet 打開後要留著（uxaudit 10/14 HIGH）。
 * 原因：pointerup 就開 sheet，觸控補發的 click 落在剛出現的遮罩上被當成「點外面關閉」。
 * 其他 spec 都用滑鼠 click，抓不到；這條用 hasTouch＋tap，並確認點遮罩仍可正常關閉。
 */

import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";

test.use({ hasTouch: true, isMobile: true });

test("觸控點中央圓鈕 → 記一筆留著不自己關；再點遮罩才關", async ({ page, accounts }) => {
  const email = accounts.newEmail("touch");
  await loginAsNewUser(page, email, "/journal");
  await page.goto("/journal");
  await waitForHydration(page, 'button[aria-label="記一筆"]');

  await page.getByRole("button", { name: "記一筆", exact: true }).tap();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(800);
  await expect(sheet).toBeVisible();

  // 真的點遮罩（sheet 上方露出的那一條）仍會關閉
  await page.touchscreen.tap(187, 20);
  await expect(sheet).toBeHidden();
});
