/** 公開頁匿名可讀：首頁、分享頁、作品特輯、單集閱讀頁（前置資料每條測試自己種，不依賴 DB 既有資料） */

import { seedPublicFixtures } from "./fixtures/public-seed";
import { expect, test } from "./fixtures/test";

test.describe("公開頁（匿名）", () => {
  test("首頁", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("robots.txt 與 sitemap.xml；文章頁有 JSON-LD 與 SEO 標題", async ({ page, request, accounts }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /me");
    expect(robotsText).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("/s/");

    const { shareSlug: slug } = await seedPublicFixtures(accounts, "pub-ld");
    await page.goto(`/s/${slug}`);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld ?? "{}") as { "@type"?: string; headline?: string; url?: string };
    expect(parsed["@type"]).toBe("Article");
    expect(parsed.headline).toBeTruthy();
    expect(parsed.url).toContain(`/s/${slug}`);
    await expect(page).toHaveTitle(/｜散場誌$/);
  });

  test("分享頁 /s/<slug>", async ({ page, accounts }) => {
    const { shareSlug: slug } = await seedPublicFixtures(accounts, "pub-share");
    const response = await page.goto(`/s/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await expect(page.locator("article, main").first()).toBeVisible();
  });

  test("作品特輯 /works/<slug>", async ({ page, accounts }) => {
    const { workSlug: slug } = await seedPublicFixtures(accounts, "pub-work");
    const response = await page.goto(`/works/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).not.toBeEmpty();
  });

  test("單集閱讀頁 /episodes/<id>/read", async ({ page, accounts }) => {
    const { rssEpisodeId: id } = await seedPublicFixtures(accounts, "pub-read");
    const response = await page.goto(`/episodes/${id}/read`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/episodes/${id}/read$`));
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  });

  test("不存在的分享頁回 404", async ({ page }) => {
    const response = await page.goto("/s/e2e-no-such-slug");
    expect(response?.status()).toBe(404);
  });
});
