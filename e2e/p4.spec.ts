/** P4 質感：放映廳切換規則（設定三選一、單集頁關燈覆寫、分享頁只跟系統）與平板／桌機導航 */

import { loginAsNewUser } from "./fixtures/auth";
import { seedPublicFixtures } from "./fixtures/public-seed";
import { expect, test } from "./fixtures/test";

const theme = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.dataset.theme);

test("放映廳：跟隨系統、設定固定、單集頁關燈覆寫與恢復、分享頁只跟系統", async ({ page, accounts }) => {
  // 單集頁、分享頁都用自己種的（不依賴 DB 既有資料）
  const seeded = await seedPublicFixtures(accounts, "p4");
  await page.emulateMedia({ colorScheme: "dark" });
  await loginAsNewUser(page, accounts.newEmail("p4-theme"), "/me/settings");
  await expect(page).toHaveURL(/\/me\/settings$/);
  expect(await theme(page)).toBe("screen");
  await expect(page.getByText("系統目前是深色，所以現在是放映廳。")).toBeVisible();

  // 設定固定為明亮：不再跟系統，重新整理後仍是明亮
  await page.getByRole("radio", { name: /明亮/ }).click();
  await expect.poll(() => theme(page)).toBe("light");
  await page.reload();
  expect(await theme(page)).toBe("light");
  await expect(page.getByText("固定為明亮，不再跟隨系統。")).toBeVisible();

  // 單集頁「關燈」：今晚覆寫，全 App 一起換、不改設定
  await page.goto(`/episodes/${seeded.rssEpisodeId}/read`);
  const lamp = page.getByRole("button", { name: "關燈" });
  await expect(lamp).toHaveAttribute("aria-pressed", "false");
  await lamp.click();
  await expect(lamp).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => theme(page)).toBe("screen");
  await expect(page.getByText("已關燈")).toBeAttached();

  await page.goto("/me/settings");
  expect(await theme(page)).toBe("screen");
  await expect(page.getByRole("radio", { name: /明亮/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("今晚暫時關燈中")).toBeVisible();
  await page.getByRole("button", { name: "恢復" }).click();
  await expect.poll(() => theme(page)).toBe("light");

  // 分享頁：陌生人只跟自己的系統（這裡系統是深色），不帶作者「明亮」設定
  await page.goto(`/s/${seeded.shareSlug}`);
  expect(await theme(page)).toBe("screen");
});

test("平板直欄與桌機刊頭取代底部導航", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  const rail = page.getByRole("navigation", { name: "主要導覽" }).filter({ has: page.getByRole("link", { name: "散場誌首頁" }) });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("link", { name: "目錄" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "記一筆" }).first()).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(rail).toBeHidden();
  const masthead = page.getByRole("banner").filter({ has: page.getByRole("link", { name: "說一段" }) });
  await expect(masthead).toBeVisible();
  await expect(masthead.getByRole("link", { name: "索引" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "索引" })).toBeVisible();
});
