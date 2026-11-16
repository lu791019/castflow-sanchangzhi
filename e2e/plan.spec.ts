/**
 * 排行程（10/13）：記一筆選未來時間 → 「排進行程」→ 日誌「接下來」；
 * 當天早上提醒（plan_reminder）由 /api/journal/due 帶給 worker；場次過後自動轉成已看，接上「想說說嗎？」。
 */

import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { patch } from "./fixtures/p2-seed";
import { expect, test } from "./fixtures/test";
import { seedTestWork } from "./fixtures/works-seed";

const HOUR = 60 * 60 * 1000;

function taipeiLocal(date: Date): string {
  const t = new Date(date.getTime() + 8 * HOUR);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

test("選未來時間 → 排進行程 → 接下來；當天提醒與散場後轉已看", async ({ page, accounts }) => {
  const movie = await seedTestWork(accounts, "plan");
  const email = accounts.newEmail("plan");
  await loginAsNewUser(page, email, "/journal");
  const userId = await accounts.userIdOf(email);

  // 先記一筆過去的，讓 sheet 的「最近記過的」有這部片可選
  const past = await page.request.post("/api/journal", { data: { workId: movie.id, experiencedAt: new Date(Date.now() - 30 * HOUR).toISOString(), venue: "home" } });
  expect(past.status()).toBe(201);

  await page.goto("/journal");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await sheet.getByRole("radio", { name: movie.title }).click();
  await sheet.getByRole("radio", { name: "電影院" }).click();
  await sheet.getByRole("radio", { name: "選日期時間" }).click();
  // 三天後台北 20:30（UTC 12:30）：固定在早上 9 點之後，提醒才會是當天早上（半夜跑也不會落到開演前一小時）
  const showAt = new Date(Date.now() + 3 * 24 * HOUR);
  showAt.setUTCHours(12, 30, 0, 0);
  await sheet.getByLabel("日期時間").fill(taipeiLocal(showAt));
  await expect(sheet.getByText(/計畫$/)).toBeVisible();
  await sheet.getByRole("button", { name: "排進行程" }).click();
  await expect(page.getByText("散場誌・計畫")).toBeVisible();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  // 第一次用介面記下會先帶去權限引導；沒有就留在日誌
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 5_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  }
  await page.goto("/journal");

  // 接下來出現這一場
  const upcoming = page.getByRole("region", { name: "接下來" });
  await expect(upcoming).toBeVisible();
  await expect(upcoming.getByText(movie.title)).toBeVisible();

  // DB：planned、當天早上 9 點（台北）提醒
  const [entry] = await rest<{ id: string; status: string; remind_at: string; experienced_at: string }>(
    "journal_entries",
    `select=id,status,remind_at,experienced_at&user_id=eq.${userId}&status=eq.planned`,
  );
  expect(entry).toBeDefined();
  const remindTaipei = taipeiLocal(new Date(entry.remind_at));
  expect(remindTaipei).toBe(`${taipeiLocal(showAt).slice(0, 10)}T09:00`);

  // 當天提醒：把 remind_at 撥到現在 → worker 撈到 plan_reminder
  const apiKey = process.env.API_SECRET_KEY ?? "";
  expect(apiKey).not.toBe("");
  await patch("journal_entries", `id=eq.${entry.id}`, { remind_at: new Date(Date.now() - 60_000).toISOString() });
  const due = await page.request.get("/api/journal/due", { headers: { "x-api-key": apiKey } });
  expect(due.ok()).toBe(true);
  const { reminders } = (await due.json()) as { reminders: Array<{ journalEntryId: string; kind?: string; title: string; url: string }> };
  const plan = reminders.find((r) => r.journalEntryId === entry.id);
  expect(plan).toMatchObject({ kind: "plan_reminder", title: `今天的《${movie.title}》` });
  expect(plan?.url).toMatch(/^\/journal\?/);

  // 散場後：experienced_at 撥到 5 小時前 → 下一輪撈提醒時轉成 recorded，remind_at 依設定重算
  await patch("journal_entries", `id=eq.${entry.id}`, { experienced_at: new Date(Date.now() - 5 * HOUR).toISOString(), reminded_at: new Date().toISOString() });
  const again = await page.request.get("/api/journal/due", { headers: { "x-api-key": apiKey } });
  expect(again.ok()).toBe(true);
  const [settled] = await rest<{ status: string; remind_at: string | null; reminded_at: string | null }>(
    "journal_entries",
    `select=status,remind_at,reminded_at&id=eq.${entry.id}`,
  );
  expect(settled).toMatchObject({ status: "recorded", reminded_at: null });
  expect(settled.remind_at).not.toBeNull();

  await page.goto("/journal");
  await expect(page.getByRole("region", { name: "接下來" })).toHaveCount(0);
});
