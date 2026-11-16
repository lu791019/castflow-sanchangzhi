/**
 * P2 設定與狀態：第一次打開、設定、編輯檯、我的節目、分享頁已收回。
 * 真走 magic link 登入；測試資料以 service role 寫在測試使用者名下，結束時整批刪除。
 */

import { rest } from "./fixtures/admin";
import { loginAsNewUser } from "./fixtures/auth";
import { patch, seedEpisode, seedSaidJournal, seedShow } from "./fixtures/p2-seed";
import { expect, test } from "./fixtures/test";

const HOUR_MS = 60 * 60 * 1000;

test.describe("第一次打開", () => {
  test("沒帶 next 是歡迎頁；找回專欄與先說後登入直接到 email 表單", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "散場之後" })).toBeVisible();
    await expect(page.getByRole("link", { name: "開始", exact: true })).toHaveAttribute("href", "/say");
    await page.getByRole("link", { name: /用 email 找回來/ }).click();
    await expect(page).toHaveURL(/\/login\?step=mail$/);
    await expect(page.getByRole("button", { name: "寄連結給我" })).toBeVisible();

    await page.goto("/login?next=%2Fsay%3Fresume%3D1");
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("link", { name: "開始" })).toHaveCount(0);
  });
});

test.describe("設定與編輯檯", () => {
  test("設定：預設公開範圍、提醒時間、我的節目取消訂閱", async ({ page, accounts }) => {
    const email = accounts.newEmail("p2-settings");
    const penName = await loginAsNewUser(page, email, "/me");
    const userId = await accounts.userIdOf(email);
    const feedId = await seedShow(userId, {
      title: "慢慢說",
      author: "阿寬",
      url: `https://example.com/${userId}/feed.xml`,
      episodeNumber: 122,
      airedAt: "2026-10-08T02:00:00Z",
    });

    await page.getByRole("link", { name: "設定", exact: true }).click();
    await expect(page).toHaveURL(/\/me\/settings$/);
    await expect(page.getByText(penName, { exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "私人" }).click();
    await expect(page.getByText("只有你看得到，像一本日記。")).toBeVisible();
    await expect
      .poll(async () => (await rest<{ default_visibility: string }>("profiles", `select=default_visibility&id=eq.${userId}`))[0]?.default_visibility)
      .toBe("private");
    await page.reload();
    await expect(page.getByRole("radio", { name: "私人" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: /提醒時間/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radio", { name: /半天後/ }).click();
    await expect(sheet.getByText("問你想不想說")).toBeVisible();
    await sheet.getByRole("button", { name: "好" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: /提醒時間/ })).toContainText("半天後");
    const timing = await page.evaluate(async () => (await (await fetch("/api/journal/settings")).json()) as { timing: string });
    expect(timing.timing).toBe("half_day");

    await page.getByRole("link", { name: /RSS 訂閱/ }).click();
    await expect(page.getByText("最近一集　10.08・第 122 集")).toBeVisible();
    await page.getByRole("button", { name: "取消訂閱" }).click();
    await page.getByRole("button", { name: "確定取消訂閱" }).click();
    await expect(page.getByRole("heading", { name: "還沒有訂閱的節目。" })).toBeVisible();
    expect(await rest("feeds", `select=id&id=eq.${feedId}`)).toHaveLength(0);
  });

  test("編輯檯：刪草稿可復原、5 秒後真的刪；排程改時間與取消；別人刪不到", async ({ page, accounts, browser }) => {
    const email = accounts.newEmail("p2-desk");
    await loginAsNewUser(page, email, "/me/desk");
    const userId = await accounts.userIdOf(email);
    const draftId = await seedEpisode(userId, { title: "原來我等的不是結局", blog: {} });
    const journalId = await seedSaidJournal(userId, draftId, "海街日記");
    const scheduledId = await seedEpisode(userId, {
      title: "我開始早一點出門",
      blog: {},
      scheduledAt: new Date(Date.now() + 48 * HOUR_MS).toISOString(),
    });
    await seedEpisode(userId, {
      title: "散場時外面在下雨",
      blog: {},
      publishedAt: new Date().toISOString(),
      shareSlug: `p2${Date.now().toString(36)}`,
    });

    await page.goto("/me/desk");
    await expect(page.getByText("1 份草稿・1 篇排程中・1 篇已發佈")).toBeVisible();

    // 刪除 → 復原
    await page.getByRole("button", { name: "更多：原來我等的不是結局" }).click();
    await page.getByRole("menuitem", { name: "刪除草稿…" }).click();
    await page.getByRole("button", { name: "刪除", exact: true }).click();
    await expect(page.getByText("刪掉了。")).toBeVisible();
    await page.getByRole("button", { name: "復原" }).click();
    await expect(page.getByText("原來我等的不是結局")).toBeVisible();

    // 另一位使用者打 API 刪不到
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    const otherEmail = accounts.newEmail("p2-other");
    await loginAsNewUser(otherPage, otherEmail, "/me");
    const status = await otherPage.evaluate(async (id) => (await fetch(`/api/me/drafts/${id}`, { method: "DELETE" })).status, draftId);
    expect(status).toBe(404);
    await other.close();
    expect(await rest("episodes", `select=id&id=eq.${draftId}`)).toHaveLength(1);

    // 刪除 → 等 5 秒 → 真的刪掉
    await page.getByRole("button", { name: "更多：原來我等的不是結局" }).click();
    await page.getByRole("menuitem", { name: "刪除草稿…" }).click();
    await page.getByRole("button", { name: "刪除", exact: true }).click();
    await expect(page.getByText("刪掉了。")).toBeHidden({ timeout: 8_000 });
    await expect.poll(async () => (await rest("episodes", `select=id&id=eq.${draftId}`)).length).toBe(0);
    // 連到這篇的日誌回到「還沒說」，且不會立刻再推一次提醒
    expect(await rest("journal_entries", `select=status,episode_id,remind_at&id=eq.${journalId}`)).toEqual([
      { status: "recorded", episode_id: null, remind_at: null },
    ]);

    // 排程：改到明天早上 8:00
    await page.getByRole("tab", { name: /排程中/ }).click();
    await expect(page).toHaveURL(/tab=scheduled/);
    await page.getByRole("button", { name: "改時間" }).click();
    await page.getByRole("radio", { name: "明天 早上 8:00" }).click();
    await page.getByRole("button", { name: "改好了" }).click();
    await expect(page.getByRole("button", { name: "改好了" })).toBeHidden();
    await expect(page.getByText(/週. 早上 8:00 發佈/)).toBeVisible();
    const scheduledHours = async () =>
      (await rest<{ scheduled_at: string }>("contents", `select=scheduled_at&episode_id=eq.${scheduledId}&status=eq.scheduled`)).map(
        (row) => new Date(row.scheduled_at).getUTCHours(),
      );
    await expect.poll(scheduledHours).toEqual([0, 0]); // 兩則貼文都改到台北 08:00

    // 取消排程 → 貼文回到草稿
    await page.getByRole("button", { name: "取消排程" }).click();
    await page.getByRole("button", { name: "確定取消" }).click();
    await expect(page.getByText("沒有排程中的文章。")).toBeVisible();
    expect(await rest("contents", `select=id&episode_id=eq.${scheduledId}&status=eq.scheduled`)).toHaveLength(0);
  });
});

test.describe("分享頁已收回", () => {
  test("設成私人的文章顯示已收回並劃掉期號；不存在的連結 404", async ({ page, accounts }) => {
    const email = accounts.newEmail("p2-share");
    await loginAsNewUser(page, email, "/me");
    const userId = await accounts.userIdOf(email);
    const slug = `p2w${Date.now().toString(36)}`;
    const id = await seedEpisode(userId, { title: "收回的一篇", blog: {}, publishedAt: new Date().toISOString(), shareSlug: slug });
    await patch("episodes", `id=eq.${id}`, { visibility: "private" });

    await page.goto(`/s/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "這一篇已經收回了。" })).toBeVisible();
    await expect(page.getByText(/^第.+號$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "說一段" })).toHaveAttribute("href", "/say");

    const response = await page.goto(`/s/p2-missing-${Date.now().toString(36)}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "這一篇已經收回了。" })).toBeVisible();
  });
});
