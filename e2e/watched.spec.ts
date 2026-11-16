/**
 * 第 0 步「看完了 → 你語氣的 Threads」（Q-69～Q-86，10/26）：
 * - 看完了：日誌帶入作品、打半顆星、選場域 → 去說一段（/say?journal=…&next=watched），星等寫進日誌
 * - 產出頁：種好的貼文可改（離開欄位存回）、星等勾選加 ★、附作品頁連結、字數、Threads 網頁發文連結；原話短長文鎖住
 * - 我的語氣：貼一篇 → 列出 → 刪掉
 * - 作品頁：3 人評過才顯示平均，JSON-LD 帶 AggregateRating
 * 不打 LLM：產出直接種 contents（同 uxfix）。清理交給 accounts fixture（刪使用者連帶刪日誌、樣本）。
 */

import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { createAuthor } from "./fixtures/p3idx-seed";
import { expect, test } from "./fixtures/test";
import { seedTestWork } from "./fixtures/works-seed";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

const HOUR = 60 * 60 * 1000;

async function insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[watched seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [created] = (await response.json()) as T[];
  return created;
}

async function seedJournal(userId: string, workId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const at = new Date(Date.now() - HOUR).toISOString();
  const row = await insert<{ id: string }>("journal_entries", {
    user_id: userId,
    work_id: workId,
    experienced_at: at,
    created_at: at,
    venue: "home",
    status: "recorded",
    ...extra,
  });
  return row.id;
}

test("看完了：日誌帶入作品、半顆星、選場域 → 說一段，星等寫進日誌", async ({ page, accounts }) => {
  const email = accounts.newEmail("watched");
  await loginAsNewUser(page, email, "/journal");
  const userId = await accounts.userIdOf(email);
  const work = await seedTestWork(accounts, "watched");
  const journalId = await seedJournal(userId, work.id);

  // 日誌頁有入口
  await page.goto("/journal");
  await page.getByTestId("watched-entry").tap();
  await expect(page).toHaveURL(/\/watched$/);
  await waitForHydration(page, '[data-testid="watched-work"]');
  await expect(page.getByTestId("watched-work")).toContainText(work.title);
  await expect(page.getByTestId("watched-work")).toContainText("從你的日誌帶入");

  // 點第 4 顆 → 4；再點 → 3.5
  await page.getByRole("button", { name: "4 顆星" }).tap();
  await expect(page.getByText("4 顆", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "4 顆星" }).tap();
  await expect(page.getByText("3.5 顆", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "電影院" }).tap();
  await page.screenshot({ path: "design/watched-preview-form.png" });

  await page.getByRole("button", { name: "說一段" }).tap();
  await expect(page).toHaveURL(new RegExp(`/say\\?journal=${journalId}&next=watched`));

  const [entry] = await rest<{ rating: number | string; venue: string; episode_id: string | null }>(
    "journal_entries",
    `select=rating,venue,episode_id&id=eq.${journalId}`,
  );
  expect(Number(entry.rating)).toBe(3.5);
  expect(entry.venue).toBe("cinema");
  expect(entry.episode_id).toBeNull();
});

test("產出頁：貼文可改、星等勾選、作品頁連結與字數、Threads 發文連結；原話短長文鎖住", async ({ page, accounts }) => {
  const email = accounts.newEmail("watchedres");
  await loginAsNewUser(page, email, "/journal");
  const userId = await accounts.userIdOf(email);
  const work = await seedTestWork(accounts, "watchedres");
  const episode = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: "散場隨筆",
    source: "text",
    status: "transcribed",
    work_id: work.id,
    visibility: "public",
  });
  await insert("transcripts", { episode_id: episode.id, full_text: "最後那場雨戲拍得好安靜，我在戲院裡一直不敢動，散場走出來還在想。" });
  const seeded = "最後那場雨戲好安靜，我一直不敢動。";
  await insert("contents", {
    user_id: userId,
    episode_id: episode.id,
    platform: "threads_post",
    body: seeded,
    original_body: seeded,
    status: "draft",
  });
  await seedJournal(userId, work.id, { episode_id: episode.id, status: "said", rating: 4.5 });

  await page.goto(`/watched/${episode.id}`);
  const post = page.getByTestId("watched-post");
  await waitForHydration(page, '[data-testid="watched-post"]');
  await expect(post).toHaveValue(seeded);
  await expect(page.getByText(`/works/${work.slug}`)).toBeVisible();

  const length = page.getByTestId("post-length");
  const before = Number((await length.textContent())?.split("/")[0].trim());
  await page.getByLabel(/把星等寫進貼文/).check();
  await expect(page.getByTestId("post-stars")).toHaveText("★★★★½");
  await expect(length).not.toHaveText(new RegExp(`^${before} /`));
  const href = await page.getByTestId("threads-intent").getAttribute("href");
  expect(href).toContain("https://www.threads.net/intent/post?text=");
  const text = decodeURIComponent(new URL(href!).searchParams.get("text") ?? "");
  expect(text.startsWith(`${seeded}\n\n★★★★½\n\n`)).toBe(true);
  expect(text).toContain(`/works/${work.slug}`);

  // 改稿 → 離開欄位存回
  await post.fill("改過的一句。");
  await page.getByTestId("post-length").tap();
  await expect
    .poll(async () => (await rest<{ body: string }>("contents", `select=body&episode_id=eq.${episode.id}&platform=eq.threads_post`))[0]?.body)
    .toBe("改過的一句。");

  // 原話太短：長文鎖住並說明
  await expect(page.getByRole("button", { name: /整理成長文/ })).toBeDisabled();
  await expect(page.getByText("原話太短，長文要多說一點（約 3 分鐘）。")).toBeVisible();
  await page.screenshot({ path: "design/watched-preview-result.png" });
});

test("我的語氣：貼一篇 → 列出 → 刪掉", async ({ page, accounts }) => {
  const email = accounts.newEmail("voice");
  await loginAsNewUser(page, email, "/me/settings/voice");
  const userId = await accounts.userIdOf(email);
  await page.goto("/me/settings/voice");
  await waitForHydration(page, "#voice-draft");
  await expect(page.getByText("還沒貼。現在整理 Threads 用的是散場誌的通用語氣。")).toBeVisible();

  const sample = "昨天看完回家一直睡不著，那首片尾曲在腦袋裡轉了一整晚，早上起來還在哼。";
  await page.locator("#voice-draft").fill(sample);
  await page.getByRole("button", { name: "加進我的語氣" }).tap();
  await expect(page.getByText(sample)).toBeVisible();
  await expect(page.getByRole("heading", { name: /已貼 1 篇/ })).toBeVisible();
  expect(await rest("voice_samples", `select=id&user_id=eq.${userId}&source=eq.paste`)).toHaveLength(1);

  await page.getByRole("button", { name: "刪掉這篇" }).tap();
  await expect(page.getByText(sample)).toBeHidden();
  await expect.poll(async () => (await rest("voice_samples", `select=id&user_id=eq.${userId}`)).length).toBe(0);
});

test("作品頁：以人計（同一人多筆只算最新）、3 人才有平均，JSON-LD 帶 AggregateRating", async ({ page, accounts }) => {
  const stamp = Date.now().toString(36);
  const work = await seedTestWork(accounts, "rating");
  const [a, b, c] = await Promise.all(
    ["ra", "rb", "rc"].map((tag) => createAuthor(accounts.newEmail(`rating${tag}`), `評分${tag}${stamp}`.slice(0, 12))),
  );

  // a 記了三筆（灌筆數）＋ b 一筆：仍只算 2 人、不出平均
  await seedJournal(a, work.id, { rating: 5, created_at: new Date(Date.now() - 3 * HOUR).toISOString() });
  await seedJournal(a, work.id, { rating: 5, created_at: new Date(Date.now() - 2 * HOUR).toISOString() });
  await seedJournal(a, work.id, { rating: 4, created_at: new Date(Date.now() - HOUR / 2).toISOString() });
  await seedJournal(b, work.id, { rating: 4.5 });
  await page.goto(`/works/${work.slug}`);
  await expect(page.getByTestId("work-rating")).toHaveText("散場誌 2 人評過");
  expect((await page.locator('script[type="application/ld+json"]').allTextContents()).some((json) => json.includes("AggregateRating"))).toBe(false);

  await seedJournal(c, work.id, { rating: 3.5 });
  await page.reload();
  // a 取最新的 4：(4 + 4.5 + 3.5) / 3 = 4.0
  await expect(page.getByTestId("work-rating")).toHaveText("散場誌 3 人評過・平均 ★ 4.0");
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).find((json) => json.includes("AggregateRating"));
  expect(JSON.parse(ld ?? "{}")).toMatchObject({ "@type": "Movie", aggregateRating: { ratingValue: 4, ratingCount: 3, bestRating: 5 } });
});
