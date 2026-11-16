/**
 * 封面補齊 第二輪（Dex 10/13 深夜 Q-45～Q-47）：場刊「補封面」走同一條轉存＋待審流程。
 * (a) 登入者在沒圖的場刊看得到「補封面」，貼白名單網址（TMDB）→ server 轉存自家桶、直接換圖
 * (b) 貼白名單外網址（picsum，含一次轉址）→ 提示待審、DB 有 pending、poster_url 仍空
 * (c) 上傳 → pending
 * (d) 未登入按「補封面」→ 登入頁，next 帶回原場刊
 * 需要對外網路（TMDB、picsum）。只跑本檔：
 *   E2E_PORT=3061 E2E_EMAIL_PREFIX=e2e+covers2- npx playwright test e2e/covers2.spec.ts --config <不含 globalSetup 的設定>
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { coverPublicUrl, createCoverWork, makePng, removeCoverByUrl } from "./fixtures/covers-seed";
import { expect, test } from "./fixtures/test";

const SHOTS = "design/covers2-preview";
const TMDB_POSTER = "https://image.tmdb.org/t/p/w185/gH7sCqC8bQGEic48txWcMUdomuU.jpg";
const OUTSIDE_IMAGE = "https://picsum.photos/120/180";
const PENDING_NOTE = "收到了，確認後會換上";

interface Submission {
  id: string;
  url: string;
  source: string;
  status: string;
  user_id: string;
}

function token(): string {
  return `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

async function submissionsOf(workId: string): Promise<Submission[]> {
  return rest<Submission>("work_cover_submissions", `select=id,url,source,status,user_id&work_id=eq.${workId}`);
}

async function posterOf(workId: string): Promise<string | null> {
  const [work] = await rest<{ poster_url: string | null }>("works", `select=poster_url&id=eq.${workId}`);
  return work.poster_url;
}

async function cleanupObjects(workId: string): Promise<void> {
  for (const row of await submissionsOf(workId)) await removeCoverByUrl(row.url);
}

async function openCoverForm(page: Page, slug: string) {
  await page.goto(`/works/${slug}`);
  await waitForHydration(page, "main");
  const button = page.getByRole("button", { name: "補封面", exact: true });
  await expect(button).toBeVisible();
  await button.click();
  const form = page.getByRole("form", { name: "補封面" });
  await expect(form).toBeVisible();
  return form;
}

test("(a) 場刊補封面：貼白名單網址 → 轉存自家桶、直接換圖", async ({ page, accounts }) => {
  const title = `補封面白名單 ${token()}`;
  const work = await createCoverWork({ kind: "live", title, venue: "大佳河濱公園", eventDate: "2026-10-20" });
  accounts.trackWork(work.id);
  try {
    const email = accounts.newEmail("approved");
    await loginAsNewUser(page, email, `/works/${work.slug}`);
    const uid = await accounts.userIdOf(email);
    const form = await openCoverForm(page, work.slug);
    await page.screenshot({ path: `${SHOTS}-button-open.png` });

    await form.getByRole("textbox", { name: "封面圖片網址" }).fill(TMDB_POSTER);
    await form.getByRole("button", { name: "送出" }).click();

    await expect.poll(() => posterOf(work.id), { timeout: 20_000 }).toMatch(new RegExp(`^${coverPublicUrl("u/")}`));
    const poster = (await posterOf(work.id)) as string;
    const [row] = await submissionsOf(work.id);
    expect(row).toMatchObject({ source: "url", status: "approved", user_id: uid, url: poster });

    const image = page.locator(`img[src="${poster}"]`).first();
    await expect(image).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 15_000 })
      .toBe(true);
    await expect(page.getByRole("button", { name: "補封面", exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}-approved.png` });
  } finally {
    await cleanupObjects(work.id);
  }
});

test("(b) 場刊補封面：貼白名單外網址 → 待審提示、DB pending、poster_url 仍空", async ({ page, accounts }) => {
  const work = await createCoverWork({ kind: "exhibition", title: `補封面待審 ${token()}`, venue: "北美館", eventDate: "2026-10-01", eventEndDate: "2026-12-31" });
  accounts.trackWork(work.id);
  try {
    const email = accounts.newEmail("pending");
    await loginAsNewUser(page, email, `/works/${work.slug}`);
    const form = await openCoverForm(page, work.slug);
    await form.getByRole("textbox", { name: "封面圖片網址" }).fill(OUTSIDE_IMAGE);
    await form.getByRole("button", { name: "送出" }).click();

    await expect(page.getByRole("status").filter({ hasText: PENDING_NOTE })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}-pending.png` });
    const [row] = await submissionsOf(work.id);
    expect(row).toMatchObject({ source: "url", status: "pending" });
    expect(row.url.startsWith(coverPublicUrl("u/"))).toBe(true);
    expect(await posterOf(work.id)).toBeNull();

    // 重新整理仍顯示待審（server 端認得這位讀者送過）
    await page.reload();
    await expect(page.getByRole("main").getByText(PENDING_NOTE)).toBeVisible();
    await expect(page.getByRole("button", { name: "補封面", exact: true })).toHaveCount(0);
  } finally {
    await cleanupObjects(work.id);
  }
});

test("(c) 場刊補封面：上傳 → 一律待審", async ({ page, accounts }) => {
  const work = await createCoverWork({ kind: "live", title: `補封面上傳 ${token()}`, venue: "Legacy", eventDate: "2026-09-02" });
  accounts.trackWork(work.id);
  try {
    const email = accounts.newEmail("upload");
    await loginAsNewUser(page, email, `/works/${work.slug}`);
    const form = await openCoverForm(page, work.slug);
    await form
      .getByLabel("上傳封面圖片")
      .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: makePng(60, 90, [40, 80, 160], [250, 245, 235]) });
    await expect(form.getByRole("textbox", { name: "封面圖片網址" })).toHaveValue(/\/storage\/v1\/object\/public\/covers\//, { timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}-upload-ended.png` });
    await form.getByRole("button", { name: "送出" }).click();

    await expect(page.getByRole("status").filter({ hasText: PENDING_NOTE })).toBeVisible({ timeout: 20_000 });
    const [row] = await submissionsOf(work.id);
    expect(row).toMatchObject({ source: "upload", status: "pending" });
    expect(await posterOf(work.id)).toBeNull();
  } finally {
    await cleanupObjects(work.id);
  }
});

test("(d) 未登入按「補封面」→ 登入頁，登入後回原場刊", async ({ page, accounts }) => {
  const work = await createCoverWork({ kind: "live", title: `補封面未登入 ${token()}`, venue: "Zepp", eventDate: "2026-11-09" });
  accounts.trackWork(work.id);
  await page.goto(`/works/${work.slug}`);
  await waitForHydration(page, "main");
  await page.screenshot({ path: `${SHOTS}-button.png` });
  await page.getByRole("button", { name: "補封面", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? "")).toBe(`/works/${work.slug}`);
});
