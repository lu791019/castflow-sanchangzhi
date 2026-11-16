/**
 * P3 索引、搜尋、作者專欄頁：
 * - 索引三分頁（作品書架／作者印章列／欄目封面）、首頁刊頭「索引」入口
 * - 搜尋命中作品、作者、文章句子（命中字畫底色），無結果頁
 * - 作者專欄頁只列公開＋筆名署名的文章；匿名、不公開、未發佈不出現；只有匿名文章的筆名 404
 * 執行：E2E_PORT=3054 E2E_EMAIL_PREFIX=e2e+p3idx- （不跑 globalSetup）
 */

import { authorPath } from "../src/lib/authors/path";
import { loginAsNewUser, uniquePenName } from "./fixtures/auth";
import { createArticle, createAuthor, createWork, setPenName } from "./fixtures/p3idx-seed";
import { expect, test, type Accounts } from "./fixtures/test";

/** 每次跑都不同的記號，避免撞到別人的資料 */
function token(): string {
  return `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

async function seedCatalog(accounts: Accounts, tok: string) {
  const movie = await createWork({ kind: "movie", title: `海街${tok}日記`, year: 2015 });
  const series = await createWork({ kind: "series", title: `通勤劇${tok}` });
  const show = await createWork({ kind: "podcast_episode", title: `第 42 集 ${tok}`, podcastShow: `夜貓${tok}` });
  const exhibition = await createWork({ kind: "exhibition", title: `光的抄寫${tok}・攝影展`, eventDate: "2026-10-01" });
  for (const id of [movie, series, show, exhibition]) accounts.trackWork(id);

  const writer = `晴${tok}`;
  const writerId = await createAuthor(accounts.newEmail("writer"), writer);
  const hiddenOnly = `匿${tok}`;
  const hiddenId = await createAuthor(accounts.newEmail("hidden"), hiddenOnly);

  await createArticle(writerId, { title: `看完電影${tok}，我傳了訊息給姊姊`, sentence: `梅酒${tok}要等一年。`, workId: movie, publishedAt: "2026-10-08T12:00:00Z" });
  await createArticle(writerId, { title: `第二次看${tok}`, sentence: "原來在乎也是。", workId: movie, publishedAt: "2026-10-09T12:00:00Z" });
  await createArticle(writerId, { title: `公車上的一集${tok}`, workId: series });
  await createArticle(writerId, { title: `夜裡聽完${tok}`, workId: show });
  await createArticle(writerId, { title: `展場的光${tok}`, workId: exhibition });
  // 不該出現在任何社群呈現的四種
  await createArticle(writerId, { title: `匿名的心事${tok}`, byline: "anonymous", workId: movie });
  await createArticle(writerId, { title: `私人日記${tok}`, visibility: "private" });
  await createArticle(writerId, { title: `只給連結${tok}`, visibility: "unlisted" });
  await createArticle(writerId, { title: `還沒發佈${tok}`, published: false });
  await createArticle(hiddenId, { title: `只有匿名${tok}`, byline: "anonymous" });

  return { writer, hiddenOnly };
}

test("索引三分頁：作品書架、作者印章列、欄目封面；首頁刊頭有入口", async ({ page, accounts }) => {
  const tok = token();
  const { writer, hiddenOnly } = await seedCatalog(accounts, tok);

  await page.goto("/");
  await page.getByRole("navigation", { name: "首頁切換" }).getByRole("link", { name: "索引" }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByText("總目錄")).toBeVisible();

  for (const label of ["電影", "影集", "Podcast", "展覽"]) {
    await expect(page.getByRole("heading", { level: 2, name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: new RegExp(`海街${tok}日記`) })).toContainText("3 段"); // 兩篇筆名＋一篇匿名，匿名也算一段（同作品特輯）
  await expect(page.getByRole("link", { name: new RegExp(`夜貓${tok}`) })).toBeVisible();

  await page.getByRole("navigation", { name: "索引分類" }).getByRole("link", { name: "作者" }).click();
  const writerRow = page.getByRole("link", { name: new RegExp(writer) });
  await expect(writerRow).toContainText("5 篇・最近一篇");
  await expect(writerRow.locator("[data-seal-shape]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: new RegExp(hiddenOnly) })).toHaveCount(0);

  await page.getByRole("navigation", { name: "索引分類" }).getByRole("link", { name: "欄目" }).click();
  for (const name of ["散場之後・隨筆", "影集通勤", "一集一句", "現場", "重看"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await page.locator(`main a[href="/catalog?tab=columns&column=rewatch"]`).click();
  await expect(page.getByRole("heading", { level: 2, name: "重看" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`第二次看${tok}`) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`看完電影${tok}`) })).toHaveCount(0);
});

test("搜尋：作品、作者、文章句子命中；無結果；不出現匿名與未公開", async ({ page, accounts }) => {
  const tok = token();
  const { writer } = await seedCatalog(accounts, tok);

  await page.goto(`/catalog?q=${encodeURIComponent(`海街${tok}`)}`);
  const work = page.getByRole("link", { name: new RegExp(`海街${tok}日記`) });
  await expect(work).toContainText("作品・電影・2015");
  await expect(work.locator("mark")).toHaveText(`海街${tok}`);

  // 打字搜尋（debounce 換網址）：文章句子命中
  const box = page.getByRole("searchbox", { name: "搜尋索引" });
  await box.fill(`梅酒${tok}`);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(`梅酒${tok}`)}`));
  const article = page.getByRole("link", { name: new RegExp(`看完電影${tok}`) });
  await expect(article).toContainText("文章・散場之後・隨筆");
  await expect(article.locator("mark")).toHaveText(`梅酒${tok}`);
  await expect(article).toContainText(writer);

  await page.goto(`/catalog?q=${encodeURIComponent(writer)}`);
  const authorRow = page.locator(`main a[href="${authorPath(writer)}"]`);
  await expect(authorRow).toContainText("作者");
  await expect(authorRow.locator("mark")).toHaveText(writer);

  for (const hidden of [`匿名的心事${tok}`, `私人日記${tok}`, `只給連結${tok}`, `還沒發佈${tok}`, `只有匿名${tok}`]) {
    await page.goto(`/catalog?q=${encodeURIComponent(hidden)}`);
    await expect(page.getByText(`「${hidden}」。`)).toBeVisible();
  }

  await page.goto(`/catalog?q=${encodeURIComponent(`鯨魚的夜晚${tok}`)}`);
  await expect(page.getByText("索引裡，還沒有")).toBeVisible();
  await expect(page.getByRole("button", { name: "記一筆 →" })).toBeVisible();
});

test("作者專欄頁：只列公開筆名文章；只有匿名文章的筆名 404；登入後自己的專欄也一樣", async ({ page, accounts }) => {
  const tok = token();
  const { writer, hiddenOnly } = await seedCatalog(accounts, tok);

  await page.goto(authorPath(writer));
  await expect(page.getByRole("heading", { level: 1, name: writer })).toBeVisible();
  await expect(page.locator("main [data-seal-shape]").first()).toHaveAttribute("style", /width:\s?64px/);
  for (const title of [`看完電影${tok}`, `第二次看${tok}`, `公車上的一集${tok}`, `夜裡聽完${tok}`, `展場的光${tok}`]) {
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  }
  for (const title of [`匿名的心事${tok}`, `私人日記${tok}`, `只給連結${tok}`, `還沒發佈${tok}`]) {
    await expect(page.getByText(title)).toHaveCount(0);
  }
  await expect(page.getByText(/粉絲|追蹤|排名|熱門/)).toHaveCount(0);

  const missing = await page.goto(authorPath(hiddenOnly));
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("這裡還沒有專欄。")).toBeVisible();
  expect((await page.goto(authorPath(`沒有這個人${tok}`)))?.status()).toBe(404);

  // 真登入：剛取好筆名、還沒發表 → 自己的專欄也是 404；發表一篇公開後出現
  const email = accounts.newEmail("me");
  await loginAsNewUser(page, email, "/me");
  const mine = uniquePenName();
  const myId = await accounts.userIdOf(email);
  await setPenName(myId, mine);
  expect((await page.goto(authorPath(mine)))?.status()).toBe(404);
  await createArticle(myId, { title: `我的第一篇${tok}` });
  await page.goto(authorPath(mine));
  await expect(page.getByRole("link", { name: new RegExp(`我的第一篇${tok}`) })).toBeVisible();
});
