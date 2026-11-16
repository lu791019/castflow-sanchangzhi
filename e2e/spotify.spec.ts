/**
 * Spotify 直連＋官方播放器（Q-64 A①、B）：讀者在音樂、Podcast 作品頁「告訴我們」貼 Spotify 連結 →
 * 在哪聽變直連（音樂取代搜尋列）、資訊欄出現播放器；類型不符、短網址、白名單外都回錯；影劇不收 Spotify。
 * 播放器 iframe 一律攔在瀏覽器端回假頁（不真打 open.spotify.com）；伺服器端沒有任何 Spotify 呼叫。
 * 截圖：test-results/spotify/{music,podcast}-{375,1440}.png（不入 design/）。
 */

import type { Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { createKindWork } from "./fixtures/music-seed";
import { expect, test } from "./fixtures/test";

const SHOTS = "test-results/spotify";
const ALBUM = "4aawyAB9vmqN3uQ7FjRGTy";
const SHOW = "2MAi0BvDc6GTFvKFPXnkCL";
const WIDE = { width: 1440, height: 900 };

/** 假播放器：瀏覽器端攔下 open.spotify.com（含 embed），回一張深色卡片 */
async function stubSpotify(page: Page): Promise<string[]> {
  const requested: string[] = [];
  await page.route("https://open.spotify.com/**", (route) => {
    requested.push(route.request().url());
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><body style="margin:0;height:100vh;display:flex;gap:16px;align-items:center;padding:16px;box-sizing:border-box;background:#3a2a22;color:#fff;font:14px sans-serif"><div style="width:120px;height:120px;border-radius:8px;background:#7a4a34"></div><div><b>E2E 假播放器</b><br>${route.request().url().split("?")[0]}</div></body></html>`,
    });
  });
  return requested;
}

function listenNav(page: Page) {
  // 換頁骨架串流時，隱藏的串流片段會短暫留一份同樣的內容：只看 main 裡的
  return page.getByRole("main").getByRole("navigation", { name: "收聽平台" });
}

function player(page: Page) {
  return page.getByRole("main").locator('iframe[title^="Spotify 播放器"]');
}

async function tellUs(page: Page, url: string): Promise<void> {
  await page.getByPlaceholder(/貼上 Spotify 網址/).fill(url);
  await page.getByRole("button", { name: "送出" }).click();
}

async function shot(page: Page, name: string): Promise<void> {
  await player(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}-375.png` });
  await page.setViewportSize(WIDE);
  await player(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}-1440.png` });
  await page.setViewportSize({ width: 375, height: 812 });
}

test("音樂：貼 Spotify 專輯連結 → 在哪聽變直連、出現播放器；類型不符、短網址、白名單外回錯", async ({ page, accounts }) => {
  const requested = await stubSpotify(page);
  const stamp = Date.now().toString(36);
  const work = await createKindWork("music", `e2e 專輯 ${stamp}`);
  accounts.trackWork(work.id);

  // 匿名：Spotify 只有搜尋連結、沒有播放器，有「告訴我們」
  await page.goto(`/works/${work.slug}`);
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", /open\.spotify\.com\/search\//);
  await expect(player(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "有 Spotify 連結？告訴我們" })).toBeVisible();

  const email = accounts.newEmail("spotify-music");
  await loginAsNewUser(page, email, `/works/${work.slug}`);
  const userId = await accounts.userIdOf(email);
  await waitForHydration(page, "form, button");
  await page.getByRole("button", { name: "有 Spotify 連結？告訴我們" }).click();
  const alert = page.locator("form").getByRole("alert");

  await tellUs(page, `https://open.spotify.com/show/${SHOW}`);
  await expect(alert).toHaveText("這是 Podcast 的連結，這裡要貼專輯或歌曲。");
  await tellUs(page, "https://spotify.link/AbCdEf123");
  await expect(alert).toHaveText("短網址看不出是哪一張，請貼 open.spotify.com 開頭的完整網址。");
  await tellUs(page, "https://www.kkbox.com/tw/tc/album/x");
  await expect(alert).toHaveText("在哪聽目前只收 Spotify 連結（open.spotify.com）。");
  await expect.poll(async () => (await rest("work_links", `select=id&work_id=eq.${work.id}`)).length).toBe(0);

  // 帶語系前綴與追蹤參數 → 正規化、直接公開
  await tellUs(page, `https://open.spotify.com/intl-ja/album/${ALBUM}?si=e2e123`);
  const direct = listenNav(page).getByRole("link", { name: /Spotify/ });
  await expect(direct).toHaveAttribute("href", `https://open.spotify.com/album/${ALBUM}`);
  await expect(listenNav(page).getByRole("link")).toHaveText([/Apple Music/, /Spotify/, /KKBOX/, /YouTube Music/]);
  await expect(player(page)).toHaveAttribute("src", `https://open.spotify.com/embed/album/${ALBUM}?utm_source=generator`);
  await expect(player(page)).toHaveAttribute("loading", "lazy");
  await expect(page.getByRole("button", { name: "有 Spotify 連結？告訴我們" })).toHaveCount(0);

  const rows = await rest<{ kind: string; source: string; url: string; status: string; origin: string; added_by: string }>(
    "work_links",
    `select=kind,source,url,status,origin,added_by&work_id=eq.${work.id}`,
  );
  expect(rows).toEqual([{ kind: "watch", source: "spotify", url: `https://open.spotify.com/album/${ALBUM}`, status: "active", origin: "user", added_by: userId }]);

  // 重新整理：server 端也組出直連與播放器；放映廳主題用 theme=0
  await page.reload();
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", `https://open.spotify.com/album/${ALBUM}`);
  await expect(player(page)).toHaveAttribute("src", /embed\/album\//);
  await shot(page, "music");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "screen"));
  await expect(player(page)).toHaveAttribute("src", `https://open.spotify.com/embed/album/${ALBUM}?utm_source=generator&theme=0`);
  await player(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/music-dark-375.png` });
  expect(requested.some((url) => url.startsWith(`https://open.spotify.com/embed/album/${ALBUM}`))).toBe(true);
});

test("Podcast：貼節目連結 → 在哪聽多一列 Spotify 直連、出現播放器；貼專輯回錯；影劇不收 Spotify", async ({ page, accounts }) => {
  await stubSpotify(page);
  const stamp = Date.now().toString(36);
  const podcast = await createKindWork("podcast_episode", `e2e 節目 ${stamp}`);
  accounts.trackWork(podcast.id);
  const movie = await createKindWork("movie", `e2e 電影 ${stamp}`);
  accounts.trackWork(movie.id);

  const email = accounts.newEmail("spotify-pod");
  await loginAsNewUser(page, email, `/works/${podcast.slug}`);
  await waitForHydration(page, "form, button");
  await expect(page.getByRole("main").getByText("這個節目目前查不到收聽平台。")).toBeVisible();
  await expect(player(page)).toHaveCount(0);
  await page.getByRole("button", { name: "有 Spotify 連結？告訴我們" }).click();
  await expect(page.getByPlaceholder(/貼上 Spotify 網址/)).toHaveAttribute("placeholder", /open\.spotify\.com\/show\//);

  await tellUs(page, `https://open.spotify.com/album/${ALBUM}`);
  await expect(page.locator("form").getByRole("alert")).toHaveText("這是音樂的連結，這裡要貼節目或單集。");
  await tellUs(page, `https://open.spotify.com/show/${SHOW}?si=abc`);
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", `https://open.spotify.com/show/${SHOW}`);
  await expect(page.getByRole("main").getByText("這個節目目前查不到收聽平台。")).toHaveCount(0);
  await expect(player(page)).toHaveAttribute("src", `https://open.spotify.com/embed/show/${SHOW}?utm_source=generator`);
  await page.reload();
  await expect(player(page)).toHaveAttribute("src", /embed\/show\//);
  await shot(page, "podcast");

  // 影劇不收 Spotify 連結（API 400、不寫入）
  const status = await page.evaluate(
    async ({ id, url }) =>
      (await fetch(`/api/works/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "watch", url }),
      })).status,
    { id: movie.id, url: `https://open.spotify.com/album/${ALBUM}` },
  );
  expect(status).toBe(400);
  expect(await rest("work_links", `select=id&work_id=eq.${movie.id}`)).toEqual([]);

  // 沒有 Spotify 直連的作品頁沒有播放器
  await page.goto(`/works/${movie.slug}`);
  await expect(page.getByRole("main").getByRole("heading", { name: "在哪看" })).toBeVisible();
  await expect(player(page)).toHaveCount(0);
});
