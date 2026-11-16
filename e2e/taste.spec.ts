/**
 * 品味問卷與同好配對（Q-40 A、Q-42）：
 * - 新用戶取完筆名 → 品味問卷（沒勾演出、展覽是 3 題）；先跳過 → 直接到散場之前
 * - 答完（勾了展覽多一題縣市，Q-63；挑 3 部：2 部看過、1 部想看，每部都要明確選）→ 存成品味資料，不寫日誌（UX-15）
 * - 設定頁「品味」帶出答案、改了就存
 * - service role 種另一位以筆名公開寫過其中 2 部的人（第 3 部只在他私人日誌，不能配到也不能露出）→ 散場之前出現「有人跟你看了同樣 N 部」
 * 挑作品真打外部搜尋（TMDB），外部失敗就讓測試失敗。TASTE_SHOTS=1 時輸出 375 寬截圖到 design/taste-preview-*.png。
 */

import type { Page } from "@playwright/test";
import { authorPath } from "../src/lib/authors/path";
import { rest } from "./fixtures/admin";
import { completePenName, submitLoginAndFollowLink, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { seedArticle, seedUser } from "./fixtures/p3res-seed";
import { expect, test, type Accounts } from "./fixtures/test";

const SHOTS = process.env.TASTE_SHOTS === "1";
const EXTERNAL_TIMEOUT_MS = 30_000;
const DAY = 24 * 60 * 60 * 1000;
// 散場之前要打外部熱門榜＋現算配對，機器忙時首次渲染會超過 10 秒
const BEFORE_TIMEOUT_MS = 45_000;
const PICK_QUERIES = ["海街日記", "花樣年華", "悲情城市"] as const;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(350);
  const viewport = page.viewportSize();
  if (viewport) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `design/taste-preview-${name}.png` });
  if (viewport) await page.setViewportSize(viewport);
}

async function loginToTaste(page: Page, email: string): Promise<string> {
  await page.goto(`/login?next=${encodeURIComponent("/before")}`);
  await submitLoginAndFollowLink(page, email);
  const penName = await completePenName(page, { stayOnTaste: true });
  await expect(page).toHaveURL(/\/onboarding\/taste/);
  await waitForHydration(page, 'button[role="checkbox"]');
  return penName;
}

interface PickedWork {
  id: string;
  title: string;
}

/** 從作品選擇面板搜尋並選第一筆；這次才建立的作品登記清理 */
async function pickWork(page: Page, accounts: Accounts, query: string, startedAt: number): Promise<PickedWork> {
  await page.getByRole("button", { name: /挑一部（\d\/3）/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "搜尋作品" }).fill(query);
  const first = dialog.getByRole("button").filter({ hasText: query }).first();
  await expect(first).toBeVisible({ timeout: EXTERNAL_TIMEOUT_MS });
  const created = page.waitForResponse((response) => response.url().endsWith("/api/works") && response.request().method() === "POST");
  await first.click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { data?: { work?: { id: string; title: string; created_at: string } } };
  const work = body.data?.work;
  if (!work) throw new Error(`[taste e2e] 選《${query}》沒有拿到作品`);
  if (new Date(work.created_at).getTime() >= startedAt - 5_000) accounts.trackWork(work.id);
  await expect(dialog).toBeHidden();
  return { id: work.id, title: work.title };
}

async function insertJournal(userId: string, workId: string, experiencedAt: Date): Promise<void> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/journal_entries`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, work_id: workId, experienced_at: experiencedAt.toISOString(), venue: "cinema", status: "recorded" }),
  });
  if (!response.ok) throw new Error(`[taste seed] insert journal_entries → ${response.status} ${(await response.text()).slice(0, 300)}`);
}

test("取完筆名到品味問卷，先跳過直接到散場之前", async ({ page, accounts }) => {
  const email = accounts.newEmail("skip");
  await loginToTaste(page, email);
  await expect(page.getByRole("heading", { name: "平常看什麼、聽什麼？" })).toBeVisible();
  await expect(page.getByText("品味・1/3")).toBeVisible();

  await page.getByRole("button", { name: "先跳過" }).click();
  await expect(page).toHaveURL(/\/before$/, { timeout: BEFORE_TIMEOUT_MS });
  await expect(page.getByRole("heading", { level: 1, name: /有什麼值得出門/ })).toBeVisible();
  // 沒答任何一題：不寫問卷
  const userId = await accounts.userIdOf(email);
  expect(await rest("taste_profiles", `select=user_id&user_id=eq.${userId}`)).toHaveLength(0);
  await expect(page.getByTestId("taste-matches")).toHaveCount(0);
});

test("答完問卷 → 存成品味資料、不寫日誌；作品重疊的公開作者出現在散場之前", async ({ page, accounts }) => {
  // 三次外部搜尋＋兩次散場之前現算＋設定頁：比單一流程長
  test.setTimeout(300_000);
  const startedAt = Date.now();
  const email = accounts.newEmail("fill");
  await loginToTaste(page, email);
  const userId = await accounts.userIdOf(email);

  // 第一題：媒介複選
  await page.getByRole("checkbox", { name: "電影" }).click();
  await page.getByRole("checkbox", { name: "展覽" }).click();
  await expect(page.getByRole("checkbox", { name: "電影" })).toHaveAttribute("aria-checked", "true");
  await shot(page, "1-media");
  await page.getByRole("button", { name: "下一題" }).click();

  // 第二題：在家／出門（勾了展覽：多一題縣市，共 4 題，Q-63）
  await expect(page.getByText("品味・2/4")).toBeVisible();
  await page.getByRole("radiogroup", { name: "在家還是出門" }).getByRole("radio").nth(1).click();
  await shot(page, "2-setting");
  await page.getByRole("button", { name: "下一題" }).click();

  // 第三題：挑 3 部，前兩部看過、最後一部想看（不預設，每部都要選）
  await expect(page.getByText("品味・3/4")).toBeVisible();
  const works: PickedWork[] = [];
  for (const query of PICK_QUERIES) works.push(await pickWork(page, accounts, query, startedAt));
  for (const [index, work] of works.entries()) {
    await page.getByRole("radiogroup", { name: `《${work.title}》看過還是想看` }).getByRole("radio", { name: index < 2 ? "看過" : "想看" }).click();
  }
  await expect(page.getByRole("button", { name: /挑一部/ })).toHaveCount(0);
  await shot(page, "3-picks");
  await page.getByRole("button", { name: "下一題" }).click();

  // 第四題：縣市選「都可以」（＝散場之前全部縣市）
  await expect(page.getByText("品味・4/4")).toBeVisible();
  await page.getByRole("radiogroup", { name: "常在哪個縣市看演出、看展" }).getByRole("radio", { name: "都可以" }).click();
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page).toHaveURL(/\/before$/, { timeout: BEFORE_TIMEOUT_MS });

  const [profile] = await rest<{ media: string[]; setting: string }>("taste_profiles", `select=media,setting&user_id=eq.${userId}`);
  expect([...profile.media].sort()).toEqual(["exhibition", "movie"]);
  expect(profile.setting).toBe("out");
  // 不寫日誌（沒有假日期、月曆、提醒）；存在 settings 的 taste_picks:<userId>
  expect(await rest("journal_entries", `select=id&user_id=eq.${userId}`)).toHaveLength(0);
  const [stored] = await rest<{ value: { picks: Array<{ workId: string; seen: boolean }> } }>("settings", `select=value&key=eq.taste_picks:${userId}`);
  expect(stored.value.picks.filter((pick) => pick.seen)).toHaveLength(2);
  expect(stored.value.picks.filter((pick) => !pick.seen)).toHaveLength(1);
  const [city] = await rest<{ value: { city: string | null } }>("settings", `select=value&key=eq.before_city:${userId}`);
  expect(city.value).toEqual({ city: null });

  // 另一位以筆名公開寫過其中 2 部的人；第 3 部只在他私人日誌裡（不能配到、不能露出）
  const author = await seedUser(accounts.newEmail("author"), "同好");
  for (const work of works.slice(0, 2)) {
    await seedArticle(author.id, {
      workId: work.id,
      title: `散場後想起${work.title}`,
      paragraphs: ["那天走出戲院，海風很大，我想起小時候的夏天，一直走到車站才回過神來。", "第二段。"],
      pullQuote: "海風很大",
      saidAt: new Date(Date.now() - DAY),
    });
  }
  await insertJournal(author.id, works[2].id, new Date(Date.now() - DAY));

  await page.reload();
  const matches = page.getByRole("region", { name: /有人跟你看了同樣 \d+ 部/ });
  await expect(matches).toBeVisible();
  const row = matches.getByRole("link").filter({ hasText: author.penName });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("href", authorPath(author.penName));
  await expect(row).toContainText("同樣 2 部");
  for (const work of works.slice(0, 2)) await expect(row).toContainText(`《${work.title}》`);
  await expect(row).not.toContainText(`《${works[2].title}》`);
  await matches.scrollIntoViewIfNeeded();
  await shot(page, "4-matches");

  // 設定頁「品味」：帶出問卷答案，改了就存
  await page.goto("/me/settings");
  const film = page.getByRole("group", { name: "平常看什麼、聽什麼" }).getByRole("checkbox", { name: "電影" });
  await expect(film).toHaveAttribute("aria-checked", "true");
  await waitForHydration(page, 'button[role="checkbox"]');
  await page.getByRole("radiogroup", { name: "在家還是出門" }).getByRole("radio").first().click();
  await expect.poll(async () => (await rest<{ setting: string }>("taste_profiles", `select=setting&user_id=eq.${userId}`))[0]?.setting, { timeout: 30_000 }).toBe("home");
});
