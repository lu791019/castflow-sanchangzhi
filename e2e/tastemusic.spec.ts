/**
 * 品味問卷加「音樂」（10/15）：
 * - 問卷第一題六個選項，觸控點「音樂」＋「電影」→ 第二題選在家 → 第三題先跳過 → 存成品味資料（含 music）
 * - 設定頁「品味」帶出音樂；再點 Podcast 也存得進去（DB check 收 music，migration 040）
 * 用 hasTouch＋tap（新互動要能觸控點）。TASTEMUSIC_SHOTS=1 時輸出 375 寬截圖到 design/tastemusic-preview-*.png。
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { completePenName, submitLoginAndFollowLink, waitForHydration } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";

test.use({ hasTouch: true, isMobile: true });

const SHOTS = process.env.TASTEMUSIC_SHOTS === "1";
const MEDIA_GROUP = "平常看什麼、聽什麼";
const SIX_LABELS = ["電影", "影集", "Podcast", "音樂", "演出", "展覽"] as const;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(350);
  await page.screenshot({ path: `design/tastemusic-preview-${name}.png` });
}

interface StoredTaste {
  media: string[];
  setting: string | null;
}

async function tasteOf(userId: string): Promise<StoredTaste | undefined> {
  const [row] = await rest<StoredTaste>("taste_profiles", `select=media,setting&user_id=eq.${userId}`);
  return row;
}

async function mediaOf(userId: string): Promise<string[] | undefined> {
  return (await tasteOf(userId))?.media;
}

test("問卷勾音樂 → 存成品味資料 → 設定頁品味區看得到音樂、改了也存得進去", async ({ page, accounts }) => {
  const email = accounts.newEmail("music");
  // next 直接設成設定頁：跳過第三題後整頁導向過去，不必等散場之前現算
  await page.goto(`/login?next=${encodeURIComponent("/me/settings")}`);
  await submitLoginAndFollowLink(page, email);
  await completePenName(page, { stayOnTaste: true });
  await expect(page).toHaveURL(/\/onboarding\/taste/);
  await waitForHydration(page, 'button[role="checkbox"]');
  const userId = await accounts.userIdOf(email);

  // 第一題：六個選項，音樂在 Podcast 後面
  const group = page.getByRole("group", { name: MEDIA_GROUP });
  await expect(group.getByRole("checkbox")).toHaveText([...SIX_LABELS]);
  const music = group.getByRole("checkbox", { name: "音樂" });
  await music.tap();
  await group.getByRole("checkbox", { name: "電影" }).tap();
  await expect(music).toHaveAttribute("aria-checked", "true");
  // 375 寬 3×2 格線：音樂在第二列第一格、跟電影同一欄
  const [filmBox, musicBox] = await Promise.all([group.getByRole("checkbox", { name: "電影" }).boundingBox(), music.boundingBox()]);
  expect(musicBox?.x).toBeCloseTo(filmBox?.x ?? -1, 0);
  expect(musicBox?.y ?? 0).toBeGreaterThan((filmBox?.y ?? 0) + (filmBox?.height ?? 0));
  await shot(page, "1-questionnaire");
  await page.getByRole("button", { name: "下一題" }).tap();

  // 第二題：在家；第三題先跳過（已答的照存）
  await expect(page.getByText("品味・2/3")).toBeVisible();
  const home = page.getByRole("radiogroup", { name: "在家還是出門" }).getByRole("radio", { name: "在家" });
  await home.tap();
  await expect(home).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "下一題" }).tap();
  await expect(page.getByText("品味・3/3")).toBeVisible();
  await page.getByRole("button", { name: "先跳過" }).tap();
  await expect(page).toHaveURL(/\/me\/settings$/, { timeout: 45_000 });

  expect(await tasteOf(userId)).toEqual({ media: ["movie", "music"], setting: "home" });

  // 設定頁「品味」：音樂勾著；再點 Podcast → 存成 movie／podcast／music
  const settingsGroup = page.getByRole("group", { name: MEDIA_GROUP });
  await expect(settingsGroup.getByRole("checkbox", { name: "音樂" })).toHaveAttribute("aria-checked", "true");
  await expect(settingsGroup.getByRole("checkbox", { name: "Podcast" })).toHaveAttribute("aria-checked", "false");
  await waitForHydration(page, 'button[role="checkbox"]');
  await settingsGroup.getByRole("checkbox", { name: "Podcast" }).tap();
  await expect.poll(() => mediaOf(userId), { timeout: 30_000 }).toEqual(["movie", "podcast", "music"]);
  // 存檔失敗會在品味區出 alert 並退回（全頁另有 Next 的 route announcer，不能整頁找）
  const section = page.locator('section[aria-labelledby="s-taste"]');
  await expect(section.getByRole("alert")).toHaveCount(0);
  await expect(settingsGroup.getByRole("checkbox", { name: "Podcast" })).toHaveAttribute("aria-checked", "true");
  // 首次使用的「記一筆」提示：觸控點「知道了」只收起泡泡，補發的 click 不能落到底下的「出門」（下面驗 setting 仍是 home）
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener("click", (event) => document.body.setAttribute("data-e2e-click", (event.target as Element).textContent ?? ""), { capture: true, once: true });
  });
  await page.getByRole("tooltip").getByRole("button", { name: "知道了" }).tap();
  await expect(page.locator("body")).toHaveAttribute("data-e2e-click", "知道了");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await section.evaluate((element) => element.scrollIntoView({ block: "start" }));
  expect(await tasteOf(userId)).toEqual({ media: ["movie", "podcast", "music"], setting: "home" });
  await shot(page, "2-settings");
});
