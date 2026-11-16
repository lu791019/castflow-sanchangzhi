/**
 * 散場當下提醒（10/14，Q-37）：排了行程的人，散場那一刻收到「散場了？」，點開直接說一段、作品已帶好。
 * 種一筆 3 小時前開演的電影 planned → 打 /api/journal/due（x-api-key）→ worker 建 settle_prompt
 * → 收件匣出現 → 點開是說一段且作品已帶好；重打 due 不重複。
 */

import type { Page } from "@playwright/test";
import type { DueReminder } from "../worker/reminders.ts";
import { rest } from "./fixtures/admin";
import { loginAsNewUser } from "./fixtures/auth";
import { runWorkerFor, seedOwnEpisode, seedPlannedScreening } from "./fixtures/settle-seed";
import { expect, test, type Accounts } from "./fixtures/test";
import { seedTestWork, type SeededWork } from "./fixtures/works-seed";
import { SETTLE_TIMING } from "../src/lib/journal/settle";

type DueItem = DueReminder & { userId: string };

/** 台北 23:30–08:00 深夜不推（改隔天早上），E2E 只在白天驗推送路徑 */
function isTaipeiNight(date = new Date()): boolean {
  const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
  return minutes >= 23 * 60 + 30 || minutes < 8 * 60;
}

async function fetchDue(page: Page): Promise<DueItem[]> {
  const apiKey = process.env.API_SECRET_KEY ?? "";
  expect(apiKey).not.toBe("");
  const response = await page.request.get("/api/journal/due", { headers: { "x-api-key": apiKey } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { reminders: DueItem[] }).reminders;
}

async function pickMovie(accounts: Accounts): Promise<SeededWork> {
  return seedTestWork(accounts, "settle", { runtimeMinutes: 120 });
}

/** 讓估計散場時間落在 20 分鐘前：開演＝片長（沒有用預設）＋緩衝＋20 分鐘之前 */
function hoursAgoForRecentSettle(movie: { runtime_minutes: number | null }): number {
  const runtime = movie.runtime_minutes ?? SETTLE_TIMING.movieDefaultRuntimeMin;
  return (runtime + SETTLE_TIMING.movieBufferMin + 20) / 60;
}

test.describe("散場當下提醒", () => {
  test.skip(isTaipeiNight(), "台北深夜（23:30–08:00）不推，改隔天早上，由單元測試涵蓋");

  test("planned 電影散場 → 收件匣「散場了？」→ 點開說一段帶好作品；重打不重複", async ({ page, accounts }) => {
    const movie = await pickMovie(accounts);
    const email = accounts.newEmail("settle");
    await loginAsNewUser(page, email, "/journal");
    const userId = await accounts.userIdOf(email);
    const entryId = await seedPlannedScreening(userId, movie.id, hoursAgoForRecentSettle(movie));

    // due 帶出散場提醒（深連結＝說一段帶該條目）
    const due = await fetchDue(page);
    const settle = due.find((item) => item.journalEntryId === entryId && item.kind === "settle_prompt");
    expect(settle).toMatchObject({
      title: "散場了？",
      body: `《${movie.title}》剛結束。說一段，或打幾句。`,
      url: `/say?journal=${entryId}`,
      push: true,
      userId,
    });

    // worker 派送：建收件匣通知、推播未設定只警報、不寫 reminded_at
    const first = await runWorkerFor(due, entryId);
    expect(first.result).toMatchObject({ due: 1, notified: 1, pushed: 0, marked: 0 });
    expect(first.marked).toEqual([]);
    expect(first.alerts.filter((alert) => alert.includes("推播未設定"))).toHaveLength(1);
    const notes = await rest<{ id: string; user_id: string; title: string }>(
      "notifications",
      `select=id,user_id,title&journal_entry_id=eq.${entryId}&kind=eq.settle_prompt`,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ user_id: userId, title: "散場了？" });

    // 重打 due：已建過就不再帶出；worker 再跑也不會多一則
    const again = await fetchDue(page);
    expect(again.some((item) => item.journalEntryId === entryId && item.kind === "settle_prompt")).toBe(false);
    const second = await runWorkerFor(again, entryId);
    expect(second.result.notified).toBe(0);
    expect(await rest("notifications", `select=id&journal_entry_id=eq.${entryId}`)).toHaveLength(1);

    // 收件匣出現同一則
    await page.goto("/notifications");
    const line = page.getByText(`散場了？《${movie.title}》剛結束。說一段，或打幾句。`);
    await expect(line).toBeVisible();
    await page.screenshot({ path: "design/settle-preview-inbox.png", fullPage: true });

    // 點「說說看」→ 說一段，作品已帶好、從散場時間起算
    const row = page.locator("div.grid").filter({ has: line });
    await row.getByRole("button", { name: "說說看" }).click();
    await expect(page).toHaveURL(new RegExp(`/say\\?journal=${entryId}`), { timeout: 30_000 });
    await expect(page.getByText(movie.title).first()).toBeVisible();
    await expect(page.getByText(/散場後 \d+ 分鐘|剛散場/)).toBeVisible();
    await page.screenshot({ path: "design/settle-preview-say.png", fullPage: true });

    const [read] = await rest<{ read_at: string | null }>("notifications", `select=read_at&id=eq.${notes[0].id}`);
    expect(read.read_at).not.toBeNull();
  });

  test("散場前已經說過同一部（同天有內容）→ 不推", async ({ page, accounts }) => {
    const movie = await pickMovie(accounts);
    const email = accounts.newEmail("settle-said");
    await loginAsNewUser(page, email, "/journal");
    const userId = await accounts.userIdOf(email);
    const entryId = await seedPlannedScreening(userId, movie.id, hoursAgoForRecentSettle(movie));
    await seedOwnEpisode(userId, movie.id);

    const due = await fetchDue(page);
    expect(due.some((item) => item.journalEntryId === entryId)).toBe(false);
  });
});
