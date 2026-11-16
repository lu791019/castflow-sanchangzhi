/**
 * 全站阿拉伯數字（10/11 Dex 拍板）：由資料算出來的數量、期號、日期一律阿拉伯數字，畫面上不再出現國字數值。
 * 走一位作者的完整資料：日誌、記一筆戳章、文章（共鳴數、讀者來函）、作品特輯、場刊、索引、我的 › 來信、OG 卡。
 * 只跑本檔：E2E_EMAIL_PREFIX=e2e+p3digits- E2E_PORT=3055 npx playwright test e2e/p3digits.spec.ts --config …（不要跑 globalSetup）
 * 截圖：P3DIGITS_SCREENSHOT_DIR=design
 */

import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { seedJournal, seedLetter, seedLiveWork } from "./fixtures/p3digits-seed";
import { seedArticle, seedMark, seedUser, seedWorkRow } from "./fixtures/p3res-seed";
import { expect, test } from "./fixtures/test";

const SCREENSHOT_DIR = process.env.P3DIGITS_SCREENSHOT_DIR;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LEDE = "散場之後我在公車上坐了很久，一直沒有把耳機拿下來。";
const LINE = "看到她們坐在簷廊一起吃飯那一段，我胸口一緊。";
/** 國字數值的樣子：期號、N 部／篇／段／人／封、月日 */
const CHINESE_NUMERAL = /第[〇一二三四五六七八九]{3,}號|[〇兩二三四五六七八九十百]+(部|篇|段|人|封|晚|天後|筆紀錄)|[一二三四五六七八九十]+月[一二三四五六七八九十]+日/;

async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/p3digits-preview-${name}.png`, fullPage });
}

async function expectNoChineseNumerals(page: Page): Promise<void> {
  const text = await page.locator("body").innerText();
  expect(text.match(CHINESE_NUMERAL)?.[0] ?? null, page.url()).toBeNull();
}

/** 台北日期 YYYY-MM-DD */
function taipeiDate(ms: number): string {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

// 作品特輯、場刊：換頁骨架串流時，隱藏的串流片段會短暫留一份同樣的內容（打包版較常見），那幾句只看 main 裡的
test("數量、期號、日期全站阿拉伯數字", async ({ page, accounts }) => {
  const now = Date.now();
  const email = accounts.newEmail("me");
  const myName = await loginAsNewUser(page, email, "/me");
  const myId = await accounts.userIdOf(email);
  const reader = await seedUser(accounts.newEmail("reader"), "讀");
  const peer = await seedUser(accounts.newEmail("peer"), "哲");
  const third = await seedUser(accounts.newEmail("third"), "晴");

  const movie = await seedWorkRow("海街日記");
  accounts.trackWork(movie.id);
  const firstNight = taipeiDate(now - 2 * DAY);
  const lastNight = taipeiDate(now - DAY);
  const live = await seedLiveWork("島嶼夜歌・草地音樂會", firstNight, lastNight);
  accounts.trackWork(live.id);

  const mine = await seedArticle(myId, {
    workId: movie.id, title: "姊姊", paragraphs: [LEDE, LINE, "回家路上我傳了訊息給姊姊。"], pullQuote: "有些人一直都在。", saidAt: new Date(now - 2 * HOUR),
  });
  await seedArticle(peer.id, {
    workId: movie.id, title: "梅酒", paragraphs: [LEDE, "梅酒要等一年，原來在乎也是。"], pullQuote: "我站在大姊那一邊。", saidAt: new Date(now - 3 * HOUR),
  });
  await seedArticle(third.id, {
    workId: movie.id, title: "很久以前", paragraphs: [LEDE, "櫻花隧道那一段。"], pullQuote: "我們兩個都沒說話。", saidAt: new Date(now - 40 * DAY),
  });
  const myLive = await seedArticle(myId, {
    workId: live.id, title: "草地上", paragraphs: [LEDE, "最後一首歌大家都坐下來了。"], pullQuote: "大家都坐下來了。", saidAt: new Date(now - 2 * DAY + 2 * HOUR),
  });
  const peerLive = await seedArticle(peer.id, {
    workId: live.id, title: "雨夜", paragraphs: [LEDE, "下雨了也沒人走。"], pullQuote: "下雨了也沒人走。", saidAt: new Date(now - DAY + 2 * HOUR),
  });
  await seedJournal(myId, { workId: live.id, title: "", experiencedAt: new Date(`${firstNight}T21:30:00+08:00`), venue: "live", episodeId: myLive.id });
  await seedJournal(peer.id, { workId: live.id, title: "", experiencedAt: new Date(`${lastNight}T21:40:00+08:00`), venue: "live", episodeId: peerLive.id });
  await seedJournal(myId, { workId: movie.id, title: "", experiencedAt: new Date(now - 3 * HOUR), venue: "cinema", episodeId: mine.id });
  await seedJournal(myId, { workId: null, title: "花樣年華", experiencedAt: new Date(now - 3 * DAY), venue: "home" });
  await seedJournal(myId, { workId: null, title: "重慶森林", experiencedAt: new Date(now - 4 * DAY), venue: "home" });

  for (const [index, marker] of [reader, peer, third].entries()) {
    await seedMark(marker.id, mine.id, LINE, 0, new Date(now - (10 - index) * 60 * 1000));
  }
  await seedLetter({ episodeId: mine.id, senderId: reader.id, authorId: myId, body: "我也有一個這樣的姊姊。" });
  await seedLetter({ episodeId: mine.id, senderId: peer.id, authorId: myId, body: "梅酒那段我也記得。", published: true });

  // 日誌：月份「10 月」、統計句
  await page.goto("/journal");
  await expect(page.getByText(/看了 \d+ 部/)).toBeVisible();
  await expect(page.getByText(/^\d+ 筆紀錄・\d+ 篇文章$/)).toBeVisible();
  await expect(page.getByText(/^\d{1,2} 月$/).first()).toBeVisible();
  await expectNoChineseNumerals(page);
  await shot(page, "journal");

  // 記一筆 → 日期章「10 月 10 日」
  const center = page.getByRole("button", { name: "記一筆", exact: true });
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await center.click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await sheet.getByRole("radio", { name: "海街日記" }).click();
  await sheet.getByRole("radio", { name: "電影院" }).click();
  await sheet.getByRole("radio", { name: "昨天" }).click();
  await shot(page, "log-ready", false);
  await sheet.getByRole("button", { name: "記下了" }).click();
  // 種子剛記過海街日記：2 小時內再記要在 sheet 內確認（UX-26）
  await sheet.getByRole("alertdialog", { name: "再記一筆確認" }).getByRole("button", { name: "再記一筆" }).click();
  await expect(page.getByText(/^\d{1,2} 月 \d{1,2} 日$/)).toBeVisible();
  await shot(page, "log-stamp", false);

  // 文章頁：句邊共鳴數、讀者來函
  await page.goto(`/s/${mine.slug}`);
  await expect(page.locator("[data-passage]").filter({ hasText: LINE }).locator("[data-resonance-count]")).toHaveText("3");
  await expect(page.getByText("作者選刊・1 封")).toBeVisible();
  await expectNoChineseNumerals(page);
  await shot(page, "article");

  // 說一段後校樣（已發佈）：期號
  await page.goto(`/proof/${mine.id}`);
  await expectNoChineseNumerals(page);
  await shot(page, "proof", false);

  // 作品特輯：期號直排、同場人數、本週／更早段數
  await page.goto(`/works/${movie.slug}`);
  await expect(page.getByRole("main").getByText(/作品特輯・第\d{4}號/)).toBeVisible();
  await expect(page.getByRole("main").getByText(/這一週，有 2 個人看完《海街日記》/)).toBeVisible();
  await expect(page.getByRole("main").locator('[data-feeling-group="week"]')).toContainText("2 段");
  await expect(page.getByRole("main").locator('[data-feeling-group="earlier"]')).toContainText("1 段");
  await expectNoChineseNumerals(page);
  await shot(page, "works");

  // 場刊：直排日期、第幾晚、期號
  await page.goto(`/works/${live.slug}`);
  await expect(page.getByRole("main").getByText(/^場刊 第 \d{4} 號$/)).toBeVisible();
  await expect(page.getByText("第 2 晚", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("第 1 晚", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("main").getByText(/^2 個晚上，2 個人待到散場/)).toBeVisible();
  await expectNoChineseNumerals(page);
  await shot(page, "programme");

  // 索引四分頁
  await page.goto("/catalog");
  await expect(page.getByRole("heading", { level: 1, name: /^\d+ 部作品， \d+ 個人說過。$/ })).toBeVisible();
  await expectNoChineseNumerals(page);
  await shot(page, "catalog-works");
  await page.goto("/catalog?tab=authors");
  await expect(page.getByText(/^2 篇・最近一篇 \d{2}\.\d{2}$/).first()).toBeVisible();
  await expectNoChineseNumerals(page);
  await shot(page, "catalog-authors");
  await page.goto("/catalog?tab=columns");
  await expectNoChineseNumerals(page);
  await shot(page, "catalog-columns");
  await page.goto(`/catalog?q=${encodeURIComponent("海街日記")}`);
  await expectNoChineseNumerals(page);
  await shot(page, "catalog-search");

  // 作者頁
  await page.goto(`/authors/${encodeURIComponent(myName)}`);
  await expectNoChineseNumerals(page);
  await shot(page, "author");

  // 我的、來信
  await page.goto("/me");
  await expect(page.getByRole("link", { name: "來信，1 封未讀" })).toBeVisible();
  await expectNoChineseNumerals(page);
  await shot(page, "me");
  await page.goto("/me/letters");
  await expect(page.getByRole("heading", { name: "2 封信，1 封還沒拆。" })).toBeVisible();
  await shot(page, "letters");

  // 首頁（登入者裸 `/` 會轉到日誌，帶 tab 看目錄）
  await page.goto("/?tab=all");
  await expectNoChineseNumerals(page);
  await shot(page, "home");

  // OG 卡：期號「第 0142 號」
  const og = await page.request.get(`/s/${mine.slug}/opengraph-image`);
  expect(og.status()).toBe(200);
  if (SCREENSHOT_DIR) await writeFile(`${SCREENSHOT_DIR}/p3digits-preview-og.png`, await og.body());
});
