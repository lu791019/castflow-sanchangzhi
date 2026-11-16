/**
 * 分享出去的樣子：OG 預覽卡 A 有海報／B 直排字卡／C Podcast、meta tag、私人文章不出內容。
 * 登入建筆名後以 service role 種已發佈文章；分享頁與 OG 圖是公開的，用同一個 context 讀。
 * 設 OG_PREVIEW_DIR 時把實際輸出的卡存成 og-preview-*.png 供對照設計稿。
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser } from "./fixtures/auth";
import { seedPublished, seedWork } from "./fixtures/og-seed";
import { expect, test } from "./fixtures/test";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w185/gH7sCqC8bQGEic48txWcMUdomuU.jpg";
const PODCAST_COVER = "https://files.soundon.fm/1601380848736-bce0f26a-745c-4266-aee1-6d4df3479752.jpeg";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

/** 讀 meta（打包版的 metadata 會串流晚到：呼叫端用 expect.poll 等它出現） */
async function meta(page: Page, key: string): Promise<string | null> {
  const byProperty = page.locator(`meta[property="${key}"]`);
  if ((await byProperty.count()) > 0) return byProperty.first().getAttribute("content");
  const byName = page.locator(`meta[name="${key}"]`);
  return (await byName.count()) > 0 ? byName.first().getAttribute("content") : null;
}

/** 取 og:image、以未登入的 request（同社群爬蟲）確認是 200 PNG 1200×630，回傳圖檔 */
async function fetchOgImage(page: Page, request: APIRequestContext, slug: string): Promise<Buffer> {
  await expect.poll(() => meta(page, "og:image")).toContain(`/s/${slug}/opengraph-image`);
  const ogImage = await meta(page, "og:image");
  await expect.poll(() => meta(page, "og:image:width")).toBe("1200");
  await expect.poll(() => meta(page, "og:image:height")).toBe("630");
  const response = await request.get(ogImage!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(Array.from(body.subarray(0, 4))).toEqual(PNG_MAGIC);
  // PNG IHDR：寬高在第 16–23 byte
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
  return body;
}

async function savePreview(name: string, body: Buffer): Promise<void> {
  const dir = process.env.OG_PREVIEW_DIR;
  if (dir) await writeFile(path.join(dir, `og-preview-${name}.png`), body);
}

test("OG 卡三種版型、meta tag 齊全；私人文章只給中性卡", async ({ page, request, accounts }) => {
  const email = accounts.newEmail("og-cards");
  const penName = await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);

  const movieId = await seedWork({ kind: "movie", title: "海街日記", posterUrl: TMDB_POSTER });
  const liveId = await seedWork({ kind: "live", title: "島嶼夜歌", venue: "草地音樂會", eventDate: "2026-10-04" });
  const podId = await seedWork({
    kind: "podcast_episode",
    title: "第一次自己租房",
    podcastShow: "慢慢說",
    episodeNumber: 7,
    posterUrl: PODCAST_COVER,
  });
  [movieId, liveId, podId].forEach((id) => accounts.trackWork(id));

  const cards = [
    {
      name: "A-poster",
      slug: await seedPublished(userId, {
        workId: movieId,
        title: "看完《海街日記》，我傳了訊息給很久沒聊的姊姊",
        lede: "一部幾乎沒有發生大事的電影，讓她在回家的公車上，按下了那句「最近好嗎」。",
        pullQuote: "有些人一直都在，只是我很久沒有好好看她。",
        experiencedAt: "2026-10-07T13:30:00.000Z",
        saidAt: "2026-10-08T04:00:00.000Z",
      }),
      title: "看完《海街日記》，我傳了訊息給很久沒聊的姊姊",
    },
    {
      name: "B-plate",
      slug: await seedPublished(userId, {
        workId: liveId,
        title: "草地上，大家都在小聲跟著唱",
        lede: "島嶼夜歌散場，草地上大家都在小聲跟著唱，我也是，一直唱到燈亮。",
        pullQuote: "原來一群陌生人，也可以一起很安靜。",
        experiencedAt: "2026-10-04T13:00:00.000Z",
        venue: "live",
        saidAt: "2026-10-04T13:40:00.000Z",
      }),
      title: "草地上，大家都在小聲跟著唱",
    },
    {
      name: "C-podcast",
      slug: await seedPublished(userId, {
        workId: podId,
        title: "那集在講搬家，我想起第一次自己租的房間",
        lede: "通勤路上聽《慢慢說》，想起第一次自己租的房間，燈關不關都由自己決定。",
        pullQuote: "那間房間很小，但燈關不關，第一次由我決定。",
        experiencedAt: "2026-09-27T00:30:00.000Z",
        venue: "commute",
        saidAt: "2026-09-28T04:00:00.000Z",
      }),
      title: "那集在講搬家，我想起第一次自己租的房間",
    },
  ];

  for (const card of cards) {
    await page.goto(`/s/${card.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: card.title })).toBeVisible();
    await expect.poll(() => meta(page, "og:title")).toBe(card.title);
    await expect.poll(() => meta(page, "og:type")).toBe("article");
    await expect.poll(() => meta(page, "og:description")).toBeTruthy();
    await expect.poll(() => meta(page, "og:site_name")).toBe("散場誌");
    await expect.poll(() => meta(page, "twitter:card")).toBe("summary_large_image");
    await expect.poll(() => meta(page, "twitter:image")).toContain(`/s/${card.slug}/twitter-image`);
    const body = await fetchOgImage(page, request, card.slug);
    // 內容卡帶整套字型與圖，比中性卡大得多
    expect(body.byteLength).toBeGreaterThan(60_000);
    await savePreview(card.name, body);
  }

  // 私人：分享頁是「已收回」，meta 不帶文章內容，OG 圖是中性卡
  const privateSlug = await seedPublished(userId, {
    workId: movieId,
    title: "這篇我只想自己留著",
    lede: "不想給別人看的一段話，留在自己的專欄裡就好，這篇不分享出去。",
    pullQuote: "這句不該出現在任何預覽卡上。",
    visibility: "private",
    saidAt: "2026-10-09T04:00:00.000Z",
  });
  await page.goto(`/s/${privateSlug}`);
  await expect(page.getByText("這一篇已經收回了").first()).toBeVisible();
  await expect.poll(() => meta(page, "og:title")).toBe("這一篇已經收回了");
  await expect.poll(() => meta(page, "og:description")).toBe("真實的感受，比完美的評價更值得被聽見");
  expect(await page.content()).not.toContain("這句不該出現");
  const neutral = await fetchOgImage(page, request, privateSlug);
  const missing = await request.get("/s/no-such-slug-og/opengraph-image");
  expect(missing.status()).toBe(200);
  expect(Buffer.compare(neutral, await missing.body())).toBe(0);
  await savePreview("D-neutral", neutral);

  // 完全不存在的連結：同樣不帶內容的 meta
  await page.goto("/s/no-such-slug-og");
  await expect.poll(() => meta(page, "og:title")).toBe("這一篇已經收回了");
  await expect.poll(() => meta(page, "og:description")).toBe("真實的感受，比完美的評價更值得被聽見");

  expect(penName).toBeTruthy();
});

test("校樣已發佈「分享到 Threads」帶模板內文（引言／一句話／連結／#節目名，不重複標題）", async ({ page, accounts }) => {
  const email = accounts.newEmail("og-threads");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  const podId = await seedWork({ kind: "podcast_episode", title: "第一次自己租房", podcastShow: "慢慢說", episodeNumber: 7 });
  accounts.trackWork(podId);
  const slug = await seedPublished(userId, {
    workId: podId,
    title: "那集在講搬家，我想起第一次自己租的房間",
    lede: "通勤路上聽《慢慢說》，想起第一次自己租的房間，燈關不關都由自己決定。",
    pullQuote: "那間房間很小，但燈關不關，第一次由我決定。",
    saidAt: "2026-09-28T04:00:00.000Z",
  });
  const [episode] = await rest<{ id: string }>("episodes", `select=id&share_slug=eq.${slug}`);
  // 攔下 window.open，讀出帶給 Threads 的內文
  await page.addInitScript(() => {
    const opened: string[] = [];
    Object.assign(window, { __opened: opened });
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return null;
    };
  });
  await page.goto(`/proof/${episode.id}`);
  await page.getByRole("button", { name: "分享到 Threads" }).click();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  const text = new URL(opened[0]).searchParams.get("text") ?? "";
  expect(text.split("\n\n")).toEqual([
    "「那間房間很小，但燈關不關，第一次由我決定。」",
    "通勤路上聽《慢慢說》，想起第一次自己租的房間，燈關不關都由自己決定。",
    expect.stringContaining(`/s/${slug}`),
    "#慢慢說",
  ]);
  expect(text).not.toContain("那集在講搬家");
});
