/**
 * 表單頁寬度上限（Dex 10/15）：寬螢幕外框維持 1360（左緣對齊刊頭的「散場誌」），
 * 表單頁（設定、我的節目、搬進舊文章）的內容靠左、最寬 736（max-w-3xl 768 扣頁面自帶的左右 16，最接近 720 的 token）；手機不變。
 * 取筆名、品味問卷在帳號流程版面（沒有刊頭、本來就是 480 單欄置中），只確認沒有被撐寬。
 * FORMWIDTH_SHOTS=<標籤> 時輸出 1440／375 截圖到 test-results/formwidth/<標籤>-*.png（改前改後各跑一次）。
 */

import type { Locator, Page } from "@playwright/test";
import { loginAsNewUser } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";

const SHOTS = process.env.FORMWIDTH_SHOTS ?? "";
const MOBILE = { width: 375, height: 812 };
const WIDE = { width: 1440, height: 900 };
/** 表單內容最寬：max-w-3xl 768 扣頁面自帶的左右 16（同 components/app-shell/form-measure.tsx） */
const FORM_MAX = 736;
/** 帳號流程的單欄（app/(account)/layout.tsx） */
const ACCOUNT_COLUMN = 480;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/formwidth/${SHOTS}-${name}.png`, fullPage: true });
}

async function boxOf(locator: Locator): Promise<{ x: number; width: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("[formwidth] 量不到元素");
  return box;
}

/** 刊頭「散場誌」左緣＝頁面內容左緣（外框 1360 沒變） */
async function mastheadLeft(page: Page): Promise<number> {
  const masthead = page.getByRole("banner").filter({ has: page.getByRole("link", { name: "說一段" }) });
  return (await boxOf(masthead.getByRole("link", { name: "散場誌", exact: true }))).x;
}

interface FormPage {
  name: string;
  path: string;
  title: string;
  /** 表單裡最寬的那一塊（輸入框、選圖格） */
  field: (page: Page) => Locator;
}

const FORM_PAGES: readonly FormPage[] = [
  { name: "settings", path: "/me/settings", title: "設定", field: (page) => page.getByRole("group", { name: "平常看什麼、聽什麼" }) },
  { name: "shows", path: "/me/settings/shows", title: "我的節目", field: (page) => page.getByLabel("用 RSS 網址訂閱") },
  { name: "import", path: "/me/import", title: "搬進舊文章", field: (page) => page.getByRole("form", { name: "貼上文章網址" }) },
];

function pageHeader(page: Page, title: string): Locator {
  return page.getByRole("main").locator("header").filter({ has: page.getByRole("heading", { level: 1, name: title }) });
}

test(`表單頁：1440 外框照舊對齊刊頭、內容靠左最寬 ${FORM_MAX}；375 不變`, async ({ page, accounts }) => {
  await loginAsNewUser(page, accounts.newEmail("formw"), "/me");

  for (const target of FORM_PAGES) {
    await test.step(`${target.name} 1440：左緣對齊刊頭，頁首與表單最寬 ${FORM_MAX}`, async () => {
      await page.setViewportSize(WIDE);
      await page.goto(target.path);
      const header = pageHeader(page, target.title);
      await expect(header).toBeVisible({ timeout: 20_000 });
      await expect(target.field(page)).toBeVisible();
      await shot(page, `${target.name}-1440`);
      // 外框還是 1360：外框內緣＋16＝刊頭左緣（polish5 的對齊不變）
      const frame = await page.locator(".p4-under-sheet").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left + Number.parseFloat(getComputedStyle(node).paddingLeft), width: rect.width };
      });
      const left = await mastheadLeft(page);
      expect(Math.round(frame.left + 16)).toBe(Math.round(left));
      expect(Math.round(frame.width)).toBe(1440);
      // 寬度用 soft：量不對照樣走完其他頁（改前改後都拍得到截圖），測試仍會紅
      const head = await boxOf(header);
      expect.soft(Math.round(head.x)).toBe(Math.round(left));
      expect.soft(Math.round(head.width)).toBe(FORM_MAX);
      const field = await boxOf(target.field(page));
      expect.soft(Math.round(field.x)).toBe(Math.round(left));
      expect.soft(field.width).toBeLessThanOrEqual(FORM_MAX + 0.5);
    });

    await test.step(`${target.name} 375：照手機`, async () => {
      await page.setViewportSize(MOBILE);
      await page.goto(target.path);
      await expect(pageHeader(page, target.title)).toBeVisible({ timeout: 20_000 });
      const head = await boxOf(pageHeader(page, target.title));
      expect(Math.round(head.x)).toBe(16);
      expect(Math.round(head.width)).toBe(MOBILE.width - 32);
      await shot(page, `${target.name}-375`);
    });
  }

  for (const target of [
    { name: "pen-name", path: "/onboarding/pen-name?next=%2Fme%2Fsettings" },
    { name: "taste", path: "/onboarding/taste?next=%2Fme%2Fsettings" },
  ]) {
    await test.step(`${target.name}：帳號流程單欄 ${ACCOUNT_COLUMN} 置中，1440 沒被撐寬`, async () => {
      await page.setViewportSize(WIDE);
      await page.goto(target.path);
      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toBeVisible({ timeout: 20_000 });
      // 標題往上找到設了最寬的那一層＝帳號流程的單欄
      const column = await heading.evaluate((node) => {
        let current: Element | null = node;
        while (current && getComputedStyle(current).maxWidth === "none") current = current.parentElement;
        const rect = (current ?? node).getBoundingClientRect();
        return { x: rect.x, width: rect.width };
      });
      expect(Math.round(column.width)).toBe(ACCOUNT_COLUMN);
      expect(Math.round(column.x)).toBe((WIDE.width - ACCOUNT_COLUMN) / 2);
      await shot(page, `${target.name}-1440`);
      await page.setViewportSize(MOBILE);
      await page.goto(target.path);
      await expect(heading).toBeVisible({ timeout: 20_000 });
      await shot(page, `${target.name}-375`);
    });
  }
});
