/**
 * 封面補齊（Dex 10/13 晚：海報要留但不能空）：
 * - 記一筆場外貼封面網址（白名單 TMDB）→ server 轉存自家桶 → 場刊頁與散場之前卡片顯示該圖；
 *   同一場再記一次（上傳另一張）→ 待審（第二輪 Q-46），不覆蓋
 * - Podcast 作品建立後 poster_url 有值（iTunes 600 優先）
 * - 沒圖的作品顯示字卡封面，頁面上沒有斜線紋；目錄／散場之前／索引各截一張
 * 只跑本檔：E2E_PORT=3065 E2E_EMAIL_PREFIX=e2e+covers- npx playwright test e2e/covers.spec.ts --config <不含 globalSetup 的設定>
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { coverPublicUrl, createCoverWork, makePng, removeCoverByUrl } from "./fixtures/covers-seed";
import { createArticle, createAuthor } from "./fixtures/p3idx-seed";
import { expect, test } from "./fixtures/test";

const SHOTS = "design/covers-preview";
const FEED_ID = "954689a5-3096-43a4-a80b-7810b219cef3";
const FEED_URL = `https://feeds.soundon.fm/podcasts/${FEED_ID}.xml`;
const ITUNES_ID = 1500839292;
const TMDB_POSTER = "https://image.tmdb.org/t/p/w185/gH7sCqC8bQGEic48txWcMUdomuU.jpg";

function token(): string {
  return `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

/** 台北日期 +days → YYYY-MM-DD */
function taipeiDay(days: number): string {
  const at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(at);
}

async function stripeCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll("main *, article *")).filter((node) =>
        getComputedStyle(node).backgroundImage.includes("repeating-linear-gradient"),
      ).length,
  );
}

async function logLive(page: Page, fill: { name: string; venue: string; dates: string; cover?: string; upload?: Buffer }) {
  await page.goto("/me");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await sheet.getByRole("radio", { name: "音樂祭/演出" }).click();
  await sheet.getByRole("textbox", { name: "演出名或展覽名" }).fill(fill.name);
  await sheet.getByPlaceholder("哪個場館、哪片草地").fill(fill.venue);
  await sheet.getByPlaceholder("演出日或展期，例：10.09 – 10.10").fill(fill.dates);
  const coverInput = sheet.getByRole("textbox", { name: "封面圖片網址" });
  if (fill.cover) await coverInput.fill(fill.cover);
  if (fill.upload) {
    await sheet.getByLabel("上傳封面圖片").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: fill.upload });
    await expect(coverInput).toHaveValue(/\/storage\/v1\/object\/public\/covers\//, { timeout: 20_000 });
  }
  const preview = sheet.getByRole("img", { name: "封面預覽" });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await sheet.getByRole("button", { name: "上傳" }).scrollIntoViewIfNeeded();
  return { sheet, coverValue: await coverInput.inputValue() };
}

test("記一筆場外貼白名單封面網址 → 轉存後場刊頁與散場之前卡片顯示該圖；之後上傳的待審、不覆蓋", async ({ page, accounts }) => {
  const tok = token();
  const email = accounts.newEmail("live");
  const name = `草地封面音樂會 ${tok}`;
  const day = taipeiDay(5);
  const stored: string[] = [];

  try {
    await loginAsNewUser(page, email, "/me");
    const uid = await accounts.userIdOf(email);
    const { sheet } = await logLive(page, { name, venue: "大佳河濱公園", dates: day.replaceAll("-", "."), cover: TMDB_POSTER });
    await page.screenshot({ path: `${SHOTS}-live-fields.png` });
    await sheet.getByRole("button", { name: "記下了" }).click();
    await expect.poll(async () => (await rest("journal_entries", `select=id&user_id=eq.${uid}`)).length, { timeout: 20_000 }).toBe(1);

    const [entry] = await rest<{ work_id: string }>("journal_entries", `select=work_id&user_id=eq.${uid}`);
    accounts.trackWork(entry.work_id);
    const [work] = await rest<{ slug: string; poster_url: string }>("works", `select=slug,poster_url&id=eq.${entry.work_id}`);
    // 外部網址不熱連結：poster_url 是自家桶轉存後的網址
    expect(work.poster_url.startsWith(coverPublicUrl("u/"))).toBe(true);
    const coverUrl = work.poster_url;
    stored.push(coverUrl);

    await page.goto(`/works/${work.slug}`);
    const programmeCover = page.locator(`img[src="${coverUrl}"]`).first();
    await expect(programmeCover).toBeVisible();
    await expect.poll(() => programmeCover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `${SHOTS}-programme.png` });

    await page.goto("/before");
    const card = page.locator("article", { has: page.getByRole("heading", { name }) });
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator(`img[src="${coverUrl}"]`)).toBeVisible();

    // 同一場再記一筆、上傳另一張 → 待審，場刊封面維持第一位填的
    const again = await logLive(page, {
      name,
      venue: "大佳河濱公園",
      dates: day.replaceAll("-", "."),
      upload: makePng(60, 90, [40, 80, 160], [250, 245, 235]),
    });
    stored.push(again.coverValue);
    expect(again.coverValue).not.toContain(uid);
    await again.sheet.getByRole("button", { name: "記下了" }).click();
    // 同一場 2 小時內再記：sheet 內確認（UX-26）
    await again.sheet.getByRole("alertdialog", { name: "再記一筆確認" }).getByRole("button", { name: "再記一筆" }).click();
    await expect.poll(async () => (await rest("journal_entries", `select=id&user_id=eq.${uid}`)).length, { timeout: 20_000 }).toBe(2);
    const [after] = await rest<{ poster_url: string }>("works", `select=poster_url&id=eq.${entry.work_id}`);
    expect(after.poster_url).toBe(coverUrl);
    const pending = await rest<{ source: string }>("work_cover_submissions", `select=source&work_id=eq.${entry.work_id}&status=eq.pending`);
    expect(pending).toEqual([{ source: "upload" }]);
  } finally {
    for (const url of stored) await removeCoverByUrl(url);
  }
});

test("Podcast 作品建立後 poster_url 有值（iTunes 600）", async ({ page, accounts }) => {
  const episodes = await page.request.get(`/api/works/episodes?feed=${encodeURIComponent(FEED_URL)}`);
  expect(episodes.ok()).toBe(true);
  const body = (await episodes.json()) as { data: { episodes: Array<{ guid: string }> } };
  const guid = body.data.episodes[0]?.guid;
  expect(guid).toBeTruthy();

  const before = await rest<{ id: string }>("works", `select=id&feed_url=eq.${encodeURIComponent(FEED_URL)}&episode_guid=eq.${encodeURIComponent(guid)}`);
  const created = await page.request.post("/api/works", { data: { source: "podcast", feedUrl: FEED_URL, guid, itunesId: ITUNES_ID } });
  expect(created.ok()).toBe(true);
  const { data } = (await created.json()) as { data: { work: { id: string; poster_url: string | null } } };
  if (before.length === 0) accounts.trackWork(data.work.id);
  const [row] = await rest<{ poster_url: string | null }>("works", `select=poster_url&id=eq.${data.work.id}`);
  expect(row.poster_url).toMatch(/^https:\/\//);
  if (before.length === 0) expect(row.poster_url).toContain("mzstatic.com");
});

test("沒圖的作品顯示字卡而不是空斜線紋：目錄／散場之前／索引／作品特輯", async ({ page, accounts }) => {
  const tok = token();
  const liveDay = taipeiDay(7);
  const movie = await createCoverWork({ kind: "movie", title: `沒有海報的電影${tok}` });
  const live = await createCoverWork({ kind: "live", title: `夜歌${tok}・草地音樂會`, venue: "大佳河濱公園", eventDate: liveDay });
  const exhibition = await createCoverWork({
    kind: "exhibition",
    title: `光的抄寫${tok}・攝影展`,
    venue: "北師美術館",
    eventDate: taipeiDay(-10),
    eventEndDate: taipeiDay(20),
  });
  const podcast = await createCoverWork({ kind: "podcast_episode", title: `第 42 集 ${tok}`, podcastShow: `夜貓${tok}` });
  for (const work of [movie, live, exhibition, podcast]) accounts.trackWork(work.id);

  const writerId = await createAuthor(accounts.newEmail("writer"), `晴${tok}`);
  await createArticle(writerId, { title: `看完那部沒有海報的電影${tok}`, workId: movie.id });
  await createArticle(writerId, { title: `展場的光${tok}`, workId: exhibition.id });
  await createArticle(writerId, { title: `夜裡聽完${tok}`, workId: podcast.id });
  await createArticle(writerId, { title: `草地上${tok}`, workId: live.id });

  const email = accounts.newEmail("viewer");
  await loginAsNewUser(page, email, "/before");

  // 散場之前：場外卡片沒圖 → 字卡（演出圓章、展覽細框）
  await page.goto("/before");
  const liveCard = page.locator("article", { has: page.getByRole("heading", { name: `夜歌${tok}・草地音樂會` }) });
  await liveCard.scrollIntoViewIfNeeded();
  await expect(liveCard.locator('[data-cover="card"][data-cover-style="live"]')).toBeVisible();
  expect(await stripeCount(page)).toBe(0);
  await page.screenshot({ path: `${SHOTS}-before.png` });

  // 目錄：條目右側字卡
  await page.goto("/?tab=all");
  const entry = page.getByRole("link", { name: new RegExp(`看完那部沒有海報的電影${tok}`) }).first();
  await expect(entry.locator('[data-cover="card"]')).toBeVisible();
  expect(await stripeCount(page)).toBe(0);
  await page.screenshot({ path: `${SHOTS}-feed.png` });

  // 索引：書架每格都有封面（字卡或圖）
  await page.goto("/catalog");
  const movieShelfItem = page.getByRole("link", { name: new RegExp(`沒有海報的電影${tok}`) }).first();
  await expect(movieShelfItem.locator('[data-cover="card"][data-cover-style="screen"]')).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`夜貓${tok}`) }).first().locator('[data-cover="card"]')).toBeVisible();
  expect(await stripeCount(page)).toBe(0);
  await page.screenshot({ path: `${SHOTS}-catalog.png` });

  // 作品特輯：字卡＋圖說
  await page.goto(`/works/${movie.slug}`);
  await expect(page.locator('[data-cover="card"]').first()).toBeVisible();
  // 換頁骨架串流時，隱藏的串流片段會短暫留一份同樣的內容：只看 main 裡的
  await expect(page.getByRole("main").getByText("圖|尚無海報，以字卡代替")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}-work.png` });

  // 場刊（展覽，沒封面）：字卡細框
  await page.goto(`/works/${exhibition.slug}`);
  await expect(page.locator('[data-cover="card"][data-cover-style="exhibition"]').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}-programme-card.png` });
});
