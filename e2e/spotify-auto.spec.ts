/**
 * Spotify 自動直連（Q-64 A②）：建立音樂（專輯）或 Podcast 作品後，伺服器在回應送出後搜 Spotify（假 server），
 * 有把握的同一個作品就寫一筆 work_links（added_by system:spotify-search）→ 作品頁「在哪聽」直連與播放器自動出現；
 * 讀者之後貼的可以蓋掉自動的；429 QUOTA_EXCEEDED 時不寫、作品照常建立、alerts.log 有警報。
 * Spotify 一律走 e2e/fixtures/spotify/mock-server.ts（經 mock-router），播放器 iframe 在瀏覽器端攔成假頁，不真打 Spotify。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { deleteWorkIfUnused, rest } from "./fixtures/admin";
import { loginAsNewUser } from "./fixtures/auth";
import { AUTO_ALBUMS, MOCK_PODCAST, MUSIC_MOCK_PORT, startMusicMock, type MusicMock } from "./fixtures/music/mock-server";
import { startSpotifyMock, type SpotifyMock, type SpotifyMockData } from "./fixtures/spotify/mock-server";
import { expect, test } from "./fixtures/test";

const ALBUM = "0AutoLinkE2eAlbum00001";
const DECOY = "0AutoLinkE2eDecoy00001";
const READER_ALBUM = "0AutoLinkE2eReader0001";
const SHOW = "0AutoLinkE2eShow000001";
const [LINKED, QUOTA] = AUTO_ALBUMS;
const FEED_URL = `http://127.0.0.1:${MUSIC_MOCK_PORT}${MOCK_PODCAST.feedPath}`;
const ALERT_LOG = path.resolve("test-results", "alerts.log");

const DATA: SpotifyMockData = {
  albums: [
    // 同名不同藝人：不能被選到
    { id: DECOY, name: LINKED.name, album_type: "album", total_tracks: LINKED.tracks, artists: ["別的樂團"] },
    { id: ALBUM, name: LINKED.name, album_type: "album", total_tracks: LINKED.tracks, artists: [LINKED.artist] },
  ],
  shows: [{ id: SHOW, name: MOCK_PODCAST.name, description: "E2E 假節目" }],
};

let music: MusicMock | undefined;
let spotify: SpotifyMock | undefined;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  music = await startMusicMock();
});

test.afterAll(async () => {
  await Promise.all([music?.close(), spotify?.close()]);
});

async function useSpotify(data: SpotifyMockData): Promise<SpotifyMock> {
  await spotify?.close();
  spotify = await startSpotifyMock(data);
  return spotify;
}

/** 假 iTunes／假 feed 的作品（slug music-99000xx、feed 在 127.0.0.1）：上一輪殘留就先清，讓「新建」可重現 */
async function clearMockWork(query: string): Promise<void> {
  for (const row of await rest<{ id: string }>("works", `select=id&${query}`)) await deleteWorkIfUnused(row.id, new Date(0));
}

interface LinkRow {
  url: string;
  origin: string;
  added_by: string | null;
  status: string;
}

async function spotifyLinks(workId: string): Promise<LinkRow[]> {
  return rest<LinkRow>("work_links", `select=url,origin,added_by,status&work_id=eq.${workId}&source=eq.spotify`);
}

function listenNav(page: Page) {
  return page.getByRole("main").getByRole("navigation", { name: "收聽平台" });
}

function player(page: Page) {
  return page.getByRole("main").locator('iframe[title^="Spotify 播放器"]');
}

async function stubPlayer(page: Page): Promise<void> {
  await page.route("https://open.spotify.com/**", (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><body style='background:#333;color:#fff'>E2E 假播放器</body>" }),
  );
}

test("音樂：建立專輯 → 自動配到同名同藝人那張（不是同名別人）→ 直連＋播放器；讀者貼的可蓋掉自動的", async ({ page, accounts }) => {
  const mock = await useSpotify(DATA);
  await stubPlayer(page);
  await clearMockWork(`kind=eq.music&itunes_id=eq.${LINKED.id}`);

  const created = await page.request.post("/api/works", { data: { source: "music", itunesId: LINKED.id } });
  expect(created.ok()).toBe(true);
  const { work } = ((await created.json()) as { data: { work: { id: string; slug: string } } }).data;
  accounts.trackWork(work.id);

  await expect.poll(async () => spotifyLinks(work.id), { timeout: 20_000 }).toEqual([
    { url: `https://open.spotify.com/album/${ALBUM}`, origin: "curated", added_by: "system:spotify-search", status: "active" },
  ]);
  const search = mock.hits.find((hit) => hit.startsWith("GET /spotify/v1/search"));
  expect(search).toBeTruthy();
  const params = new URL(`http://x${(search as string).slice(4)}`).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({ type: "album", market: "TW", limit: "10" });
  expect(params.get("q")).toContain(LINKED.artist);

  await page.goto(`/works/${work.slug}`);
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", `https://open.spotify.com/album/${ALBUM}`);
  await expect(player(page)).toHaveAttribute("src", new RegExp(`embed/album/${ALBUM}`));
  // 已有直連 → 不再顯示「告訴我們」
  await expect(page.getByRole("button", { name: "有 Spotify 連結？告訴我們" })).toHaveCount(0);

  // 讀者貼的優先：API 直接送，蓋掉自動的（自動配錯時讀者能修正）
  const email = accounts.newEmail("spotify-auto");
  await loginAsNewUser(page, email, `/works/${work.slug}`);
  const userId = await accounts.userIdOf(email);
  const posted = await page.request.post(`/api/works/${work.id}/links`, {
    data: { kind: "watch", url: `https://open.spotify.com/album/${READER_ALBUM}?si=e2e` },
  });
  expect(posted.status()).toBe(201);
  expect(await spotifyLinks(work.id)).toEqual([
    { url: `https://open.spotify.com/album/${READER_ALBUM}`, origin: "user", added_by: userId, status: "active" },
  ]);
  await page.reload();
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", `https://open.spotify.com/album/${READER_ALBUM}`);
});

test("Podcast：建立單集 → 依節目名稱自動配到 Spotify 節目", async ({ page, accounts }) => {
  await useSpotify(DATA);
  await stubPlayer(page);
  await clearMockWork(`feed_url=eq.${encodeURIComponent(FEED_URL)}`);

  const created = await page.request.post("/api/works", {
    data: { source: "podcast", feedUrl: FEED_URL, guid: "e2e-music-ep1", itunesId: MOCK_PODCAST.id },
  });
  expect(created.ok()).toBe(true);
  const { work } = ((await created.json()) as { data: { work: { id: string; slug: string } } }).data;
  accounts.trackWork(work.id);

  await expect.poll(async () => (await spotifyLinks(work.id)).map((row) => [row.url, row.added_by]), { timeout: 20_000 }).toEqual([
    [`https://open.spotify.com/show/${SHOW}`, "system:spotify-search"],
  ]);
  await page.goto(`/works/${work.slug}`);
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", `https://open.spotify.com/show/${SHOW}`);
  await expect(player(page)).toHaveAttribute("src", new RegExp(`embed/show/${SHOW}`));
});

test("429 QUOTA_EXCEEDED：作品照常建立、不寫連結（保留搜尋連結）、alerts.log 有警報", async ({ page, accounts }) => {
  const mock = await useSpotify({ ...DATA, quotaExceeded: true });
  await clearMockWork(`kind=eq.music&itunes_id=eq.${QUOTA.id}`);

  const created = await page.request.post("/api/works", { data: { source: "music", itunesId: QUOTA.id } });
  expect(created.ok()).toBe(true);
  const { work } = ((await created.json()) as { data: { work: { id: string; slug: string } } }).data;
  accounts.trackWork(work.id);

  await expect.poll(() => mock.hits.filter((hit) => hit.startsWith("GET /spotify/v1/search")).length, { timeout: 20_000 }).toBe(1);
  await expect
    .poll(() => {
      try {
        return readFileSync(ALERT_LOG, "utf8").includes(`QUOTA_EXCEEDED`) && readFileSync(ALERT_LOG, "utf8").includes(`work=${work.id}`);
      } catch {
        return false;
      }
    }, { timeout: 10_000 })
    .toBe(true);
  expect(await spotifyLinks(work.id)).toEqual([]);

  await page.goto(`/works/${work.slug}`);
  await expect(listenNav(page).getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", /open\.spotify\.com\/search\//);
  await expect(player(page)).toHaveCount(0);
});
