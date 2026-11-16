/**
 * P3 共鳴（這句我也是）＋同場＋作品特輯改版：
 * 1. 兩位登入讀者對同一段留下記號 → 句邊四態與人數正確；收回；未登入按下 → 登入頁並帶回原頁
 * 2. 特輯「大家最有共鳴的一句」依共鳴資料、來源名單只點名有公開筆名文章的人；
 *    匿名署名／未公開的文章不出現在同場與來源名單
 * 只跑本檔：E2E_EMAIL_PREFIX=e2e+p3res- E2E_PORT=3053 npx playwright test e2e/p3res.spec.ts --config … （不要跑 globalSetup）
 */

import type { Locator, Page } from "@playwright/test";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { seedArticle, seedMark, seedUser, seedWorkRow } from "./fixtures/p3res-seed";
import { expect, test } from "./fixtures/test";

const LEDE = "散場之後我在公車上坐了很久，一直沒有把耳機拿下來。";
const LINE_ONE = "看到她們坐在簷廊一起吃飯那一段，我胸口一緊。";
const LINE_TWO = "我好像一直覺得自己要很快長大，才不會給誰添麻煩，卻忘了原來可以只是坐在旁邊，一起吃一頓飯。";
const LINE_THREE = "最後還是送出去了。她回了一個貼圖，是一隻在吃飯的貓。";
const SCREENSHOT_DIR = process.env.P3RES_SCREENSHOT_DIR;

function passage(page: Page, text: string): Locator {
  return page.locator("[data-passage]").filter({ hasText: text });
}

async function expectMark(page: Page, text: string, state: string, numeral: string): Promise<void> {
  const target = passage(page, text);
  await expect(target).toHaveAttribute("data-resonance-state", state);
  await expect(target.locator("[data-resonance-count]")).toHaveText(numeral);
}

function popoverAction(page: Page, name: string): Locator {
  return page.locator("[data-resonance-popover]").getByRole("button", { name, exact: true });
}

/** 按浮層按鈕並等 API 回應（避免重新整理時請求還沒寫入） */
async function toggleVia(page: Page, name: string): Promise<void> {
  const response = page.waitForResponse((res) => res.url().endsWith("/api/resonance"));
  await popoverAction(page, name).click();
  expect((await response).status()).toBe(200);
}

async function longPress(page: Page, text: string): Promise<void> {
  const target = passage(page, text).locator("p");
  await target.scrollIntoViewIfNeeded();
  await waitForHydration(page, "[data-passage] p");
  const box = await target.boundingBox();
  if (!box) throw new Error("找不到段落位置");
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
}

async function shot(page: Page, name: string): Promise<void> {
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/p3res-preview-${name}.png`, fullPage: name.endsWith("full") });
}

test("兩位讀者對同一段留記號：四態、人數、收回、未登入導去登入", async ({ browser, page, accounts }) => {
  const author = await seedUser(accounts.newEmail("author"), "作者");
  const work = await seedWorkRow("海街日記");
  accounts.trackWork(work.id);
  const article = await seedArticle(author.id, {
    workId: work.id,
    title: "看完《海街日記》，我傳了訊息給姊姊",
    paragraphs: [LEDE, LINE_ONE, LINE_TWO, LINE_THREE],
    pullQuote: "有些人一直都在，只是我很久沒有好好看她。",
    saidAt: new Date(Date.now() - 60 * 60 * 1000),
  });
  const path = `/s/${article.slug}`;

  // 讀者甲：長按留下記號 → 只有你：燒橙線、不寫數字
  await loginAsNewUser(page, accounts.newEmail("reader-a"), path);
  await expect(page).toHaveURL(new RegExp(path));
  await expectMark(page, LINE_TWO, "none", "");
  await longPress(page, LINE_TWO);
  const action = popoverAction(page, "這句我也是");
  await expect(action).toBeVisible();
  await shot(page, "popover");
  await toggleVia(page, "這句我也是");
  await expectMark(page, LINE_TWO, "mine", "");
  await expect(page.getByRole("status").filter({ hasText: "已在這段留下記號" })).toBeAttached();
  await page.reload();
  await expectMark(page, LINE_TWO, "mine", "");

  // 讀者乙：看到他人一人 → 用段尾按鈕留下 → 兩者皆有、二
  const contextB = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "zh-TW" });
  const pageB = await contextB.newPage();
  await loginAsNewUser(pageB, accounts.newEmail("reader-b"), path);
  await expect(pageB).toHaveURL(new RegExp(path));
  await expectMark(pageB, LINE_TWO, "others", "1");
  await pageB.getByRole("button", { name: "這句我也是（已有 1 人）" }).click();
  await toggleVia(pageB, "這句我也是");
  await expectMark(pageB, LINE_TWO, "both", "2");

  // 讀者甲重新整理：兩者皆有、二；收回 → 他人、一
  await page.reload();
  await expectMark(page, LINE_TWO, "both", "2");
  await shot(page, "marks");
  await page.getByRole("button", { name: "你已在這段留下記號，共 2 人。點一下可收回" }).click();
  await toggleVia(page, "收回記號");
  await expectMark(page, LINE_TWO, "others", "1");
  await page.reload();
  await expectMark(page, LINE_TWO, "others", "1");

  // 未登入：看得到人數，按下去 → 登入頁，登入後回原頁
  const anon = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "zh-TW" });
  const anonPage = await anon.newPage();
  await anonPage.goto(path);
  await expectMark(anonPage, LINE_TWO, "others", "1");
  await anonPage.getByRole("button", { name: "這句我也是（已有 1 人）" }).click();
  await popoverAction(anonPage, "這句我也是").click();
  await expect(anonPage).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));

  // API 本身也要登入
  const response = await anonPage.request.post("/api/resonance", { data: { slug: article.slug, hash: "0123456789abcdef" } });
  expect(response.status()).toBe(401);

  await contextB.close();
  await anon.close();
});

test("特輯共鳴句與來源名單、同場只列筆名公開文章", async ({ page, accounts }) => {
  const now = Date.now();
  const recent = (minutes: number) => new Date(now - minutes * 60 * 1000);
  const work = await seedWorkRow("海街日記");
  accounts.trackWork(work.id);

  const lead = await seedUser(accounts.newEmail("lead"), "晴");
  const peer = await seedUser(accounts.newEmail("peer"), "哲");
  const anon = await seedUser(accounts.newEmail("anon"), "匿");
  const hidden = await seedUser(accounts.newEmail("hidden"), "藏");
  const old = await seedUser(accounts.newEmail("old"), "舊");
  const lurker = await seedUser(accounts.newEmail("lurker"), "潛");

  const leadArticle = await seedArticle(lead.id, {
    workId: work.id, title: "姊姊", paragraphs: [LEDE, LINE_ONE, LINE_TWO], pullQuote: "有些人一直都在。", saidAt: recent(30),
  });
  const peerArticle = await seedArticle(peer.id, {
    workId: work.id, title: "梅酒", paragraphs: [LEDE, "梅酒要等一年，原來在乎也是。", LINE_THREE], pullQuote: "我站在大姊那一邊。", saidAt: recent(20),
  });
  await seedArticle(anon.id, {
    workId: work.id, title: "匿名的一篇", paragraphs: [LEDE, "不想署名的一段話。"], pullQuote: "匿名的引言不會出現。", saidAt: recent(10), byline: "anonymous",
  });
  await seedArticle(hidden.id, {
    workId: work.id, title: "只給有連結的人", paragraphs: [LEDE, "不公開的一段話。"], pullQuote: "不公開的引言。", saidAt: recent(15), visibility: "unlisted",
  });
  await seedArticle(old.id, {
    workId: work.id, title: "很久以前", paragraphs: [LEDE, "櫻花隧道那一段。"], pullQuote: "我們兩個都沒說話。", saidAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
  });

  // 第二段：四人標記（哲有公開筆名文章 → 點名；匿名、不公開、沒寫過的 → 只算人數）
  for (const [index, marker] of [peer, anon, hidden, lurker].entries()) {
    await seedMark(marker.id, leadArticle.id, LINE_ONE, 0, recent(5 - index));
  }
  await seedMark(lurker.id, peerArticle.id, "梅酒要等一年，原來在乎也是。", 0, recent(3));

  await page.goto(`/works/${work.slug}`);
  const resonance = page.locator('[data-feature-resonance="vertical"]');
  await expect(resonance).toBeVisible();
  await expect(resonance).toContainText(LINE_ONE);
  await expect(resonance).toContainText("梅酒要等一年，原來在乎也是。");
  await expect(resonance).not.toContainText("匿名的引言");
  await expect(resonance).not.toContainText("不公開的");
  const source = resonance.locator("[data-resonance-source]");
  await expect(source).toHaveText(`${peer.penName} 和另外 3 人也這樣想`);
  await expect(resonance).toContainText("依共鳴排序");

  // 這週散場的人：只有晴、哲（匿名、不公開、四十天前的都不在）
  const cast = page.locator("section", { has: page.getByRole("heading", { name: "這週散場的人" }) });
  await expect(cast).toContainText("這一週，有 2 個人看完《海街日記》");
  await expect(cast.getByRole("link", { name: `讀${lead.penName}的專欄` })).toBeVisible();
  await expect(cast.getByRole("link", { name: `讀${peer.penName}的專欄` })).toBeVisible();
  for (const absent of [anon, hidden, old]) await expect(cast).not.toContainText(absent.penName);

  // 本週／更早分段；匿名那篇列在本週但署名「匿名」、不露筆名
  await expect(page.locator('[data-feeling-group="week"]')).toContainText("3 段");
  await expect(page.locator('[data-feeling-group="week"]')).toContainText("匿名");
  await expect(page.locator('[data-feeling-group="week"]')).not.toContainText(anon.penName);
  await expect(page.locator('[data-feeling-group="earlier"]')).toContainText("1 段");
  await expect(page.getByText("不公開的一段話")).toHaveCount(0);
  await shot(page, "works-full");

  // 文章頁頁尾同場：晴的文章 → 只有哲（排除作者本人、匿名、不公開）
  await page.goto(`/s/${leadArticle.slug}`);
  const same = page.locator("section", { has: page.getByRole("heading", { name: "這週也看了《海街日記》的人" }) });
  await expect(same.getByRole("link", { name: `讀${peer.penName}的專欄` })).toHaveAttribute(
    "href",
    `/authors/${encodeURIComponent(peer.penName)}`,
  );
  for (const absent of [lead, anon, hidden, old]) await expect(same).not.toContainText(absent.penName);
  await expectMark(page, LINE_ONE, "others", "4");
  await shot(page, "article-full");
});

test("冷門只有一句（等第二句、沒有同場區）與零感受（稿紙空行、空位印）", async ({ page, accounts }) => {
  const quiet = await seedWorkRow("花樣年華");
  accounts.trackWork(quiet.id);
  const empty = await seedWorkRow("搬回家住的第一年");
  accounts.trackWork(empty.id);
  const lone = await seedUser(accounts.newEmail("lone"), "布");
  await seedArticle(lone.id, {
    workId: quiet.id,
    title: "二十年後重看，我只記得那條樓梯",
    paragraphs: [LEDE, "那條樓梯好窄，兩個人擦身而過，誰也沒有停。"],
    pullQuote: "有些話不說，是因為一說出口，就真的回不去了。",
    saidAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
  });

  await page.goto(`/works/${quiet.slug}`);
  // 作品特輯有換頁骨架：串流時隱藏的串流片段會短暫留一份同樣的內容，斷言一律只看 main 裡的
  const single = page.getByRole("main").locator('[data-feature-resonance="single"]');
  await expect(single).toContainText("目前只有一句");
  await expect(single).toContainText("有些話不說，是因為一說出口，就真的回不去了。");
  await expect(single).toContainText("等第二句");
  await expect(page.getByRole("heading", { name: "這週散場的人" })).toHaveCount(0);
  await expect(page.getByRole("main").getByText("還沒有人")).toBeVisible();
  await expect(page.getByRole("main").getByText("第二段的位置")).toBeVisible();
  await shot(page, "works-quiet-full");

  await page.goto(`/works/${empty.slug}`);
  await expect(page.getByRole("main").locator('[data-feature-resonance="empty"]')).toContainText("這一行留給你");
  await expect(page.getByRole("main").getByText("等你")).toBeVisible();
  await expect(page.getByRole("main").getByText("你的筆名")).toBeVisible();
  await shot(page, "works-empty-full");
});
