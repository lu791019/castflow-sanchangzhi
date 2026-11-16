/**
 * 多來源藝文活動（events，Q-62）：worker 收的活動走 POST /api/events/ingest 進 events 表 → 散場之前出現、
 * 和文化部同名同日只留一張（售票連結多的那張）、多來源售票連結聯集、資料來源署名、排進行程 → 日誌「接下來」。
 * 不打外網：活動由測試直接打 ingest API 種進本地 DB；TMDB、文化部、Apple 榜用本機假 server。dev server 要帶：
 *   TMDB_API_BASE=http://127.0.0.1:<E2E_TMDB_MOCK_PORT>/3
 *   CULTURE_API_BASE=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/culture CULTURE_CACHE_TTL_MS=0
 *   APPLE_TOP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/top.json ITUNES_LOOKUP_URL=http://127.0.0.1:<E2E_CULTURE_MOCK_PORT>/apple/lookup
 * 雲端有大量真活動：測試活動與文化部假演出都放在澎湖縣（真資料很少），測試帳號先選澎湖縣再找自己的卡（fixtures/before-city.ts）。
 * EVENTS_SHOTS=1 時輸出 375 寬截圖到 design/events-preview-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { QUIET_CITY, saveBeforeCity } from "./fixtures/before-city";
import { startCultureMock, taipeiDayFromNow, type CultureMock } from "./fixtures/culture/mock-server";
import { deleteTestEvents } from "./fixtures/events-table";
import { expect, test } from "./fixtures/test";
import { startTmdbMock, type TmdbMock } from "./fixtures/tmdb-mock";

const SHOTS = process.env.EVENTS_SHOTS === "1";
const RUN = Date.now().toString(36).slice(-5);
const ROCK = { title: `散場測試・多來源搖滾夜 ${RUN}`, day: taipeiDayFromNow(5), time: "20:00", venue: "觀音亭園區" };
const EXPO = { title: `散場測試・北美館測試展 ${RUN}`, start: taipeiDayFromNow(-10), end: taipeiDayFromNow(40) };
const KKTIX_URL = `https://e2e-${RUN}.kktix.cc/events/rock`;
const OPENTIX_URL = `https://www.opentix.life/event/9${Date.now()}`;
const CONCERT_KKTIX_URL = `https://e2e-${RUN}.kktix.cc/events/strings`;

test.use({ hasTouch: true });

let tmdb: TmdbMock;
let culture: CultureMock;

function event(source: string, sourceId: string, overrides: Record<string, unknown>) {
  return {
    source,
    sourceId,
    category: "concert",
    city: QUIET_CITY.name,
    showTimes: [],
    ticketUrls: [],
    imageUrl: null,
    ...overrides,
  };
}

async function ingest(request: Page["request"], source: string, events: unknown[], key = process.env.API_SECRET_KEY ?? "") {
  return request.post("/api/events/ingest", { headers: { "x-api-key": key }, data: { source, events } });
}

test.beforeAll(async () => {
  tmdb = await startTmdbMock();
  // 文化部的音樂祭、展覽也放澎湖：選了縣市後畫面上仍有文化部來源的卡，才會出現資料來源署名
  const address = QUIET_CITY.address;
  culture = await startCultureMock(RUN, { located: { concert: address, festival: address, exhibition: address } });
  await deleteTestEvents();
});

test.afterAll(async () => {
  await deleteTestEvents();
  await Promise.all([tmdb?.close(), culture?.close()]);
});

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const viewport = page.viewportSize();
  if (!viewport) return;
  await page.waitForTimeout(400);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `design/events-preview-${name}.png` });
  await page.setViewportSize(viewport);
}

const mmdd = (day: string) => `${day.slice(5, 7)}.${day.slice(8, 10)}`;

function card(region: Locator, title: string): Locator {
  return region.getByRole("article").filter({ has: region.page().getByRole("heading", { name: title, exact: true }) });
}

async function skipPermissionPrompt(page: Page): Promise<void> {
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 5_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/notifications"), { timeout: 30_000 });
  }
}

test("多來源活動進散場之前：與文化部同名同日只留一張、售票連結聯集、署名、排進行程進日誌", async ({ page, accounts }) => {
  const { concert } = culture.fixture;

  await test.step("ingest API：沒帶 key 401；帶 key 寫入並合併同一活動的售票連結", async () => {
    expect((await ingest(page.request, "kktix", [], "")).status()).toBe(401);
    expect((await ingest(page.request, "kktix", [], "wrong")).status()).toBe(401);

    const rock = { title: ROCK.title, venue: ROCK.venue, startsOn: ROCK.day, endsOn: ROCK.day, showTimes: [{ date: ROCK.day, time: ROCK.time }] };
    const strings = { title: concert.title, venue: concert.venue, startsOn: concert.day, endsOn: concert.day, showTimes: [{ date: concert.day, time: concert.time }] };
    const kktix = await ingest(page.request, "kktix", [
      event("kktix", `e2e-${RUN}-rock`, { ...rock, ticketUrls: [{ source: "kktix", url: KKTIX_URL }], sourceUrl: KKTIX_URL }),
      event("kktix", `e2e-${RUN}-strings`, { ...strings, ticketUrls: [{ source: "kktix", url: CONCERT_KKTIX_URL }], sourceUrl: CONCERT_KKTIX_URL }),
      { source: "kktix", title: "壞資料" },
    ]);
    expect(kktix.status()).toBe(200);
    expect((await kktix.json()).data).toMatchObject({ received: 3, upserted: 2, invalid: 1 });

    const opentix = await ingest(page.request, "opentix", [
      event("opentix", `e2e-${RUN}-rock`, { ...rock, ticketUrls: [{ source: "opentix", url: OPENTIX_URL }], sourceUrl: OPENTIX_URL }),
      event("opentix", `e2e-${RUN}-strings`, { ...strings, ticketUrls: [{ source: "opentix", url: `${OPENTIX_URL}1` }], sourceUrl: `${OPENTIX_URL}1` }),
    ]);
    expect((await opentix.json()).data).toMatchObject({ upserted: 2, merged: 4 });

    const tfam = await ingest(page.request, "tfam", [
      event("tfam", `e2e-${RUN}-expo`, {
        title: EXPO.title,
        category: "exhibition",
        venue: "臺北市立美術館",
        startsOn: EXPO.start,
        endsOn: EXPO.end,
        sourceUrl: "https://www.tfam.museum/Exhibition/Exhibition_Special.aspx?ddlLang=zh-tw&id=e2e",
      }),
    ]);
    expect(tfam.status()).toBe(200);

    const rows = await rest<{ source: string; ticket_urls: Array<{ url: string }> }>("events", `select=source,ticket_urls&source_id=eq.e2e-${RUN}-rock`);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.ticket_urls.map((ticket) => ticket.url).sort()).toEqual([KKTIX_URL, OPENTIX_URL].sort());
  });

  const email = accounts.newEmail("events");
  await loginAsNewUser(page, email, "/before");
  await saveBeforeCity(page, QUIET_CITY.name);
  const userId = await accounts.userIdOf(email);
  const thisWeek = page.getByRole("region", { name: "這週上映・開演・開展" });
  const tabs = page.getByRole("group", { name: "分類" });

  await test.step("散場之前：多來源活動出現；同一場只一張；購票／活動頁連結；署名列出用到的來源", async () => {
    await page.goto("/before");
    await waitForHydration(page, 'div[aria-label="分類"] button');
    await tabs.getByRole("button", { name: "演出" }).tap();

    const rock = card(thisWeek, ROCK.title);
    await expect(rock).toHaveCount(1);
    // meta 補縣市簡稱（events.city 澎湖縣 → 澎湖，放場地前面）
    await expect(rock.getByText(`演出・${QUIET_CITY.short}・${ROCK.venue}・${mmdd(ROCK.day)}`)).toBeVisible();
    await expect(rock.getByRole("link", { name: `購票：${ROCK.title}（另開視窗）` })).toHaveAttribute("href", /e2e-.*kktix\.cc|opentix\.life/);

    // 文化部也有這場（只有一個售票網址）：留多來源那張（兩個售票網址），連到多來源的售票頁
    const strings = card(thisWeek, concert.title);
    await expect(strings).toHaveCount(1);
    await expect(strings.getByRole("link", { name: `購票：${concert.title}（另開視窗）` })).not.toHaveAttribute("href", "https://www.opentix.life/event/e2e");
    await shot(page, "filter-live");

    await tabs.getByRole("button", { name: "展覽" }).tap();
    const expo = card(thisWeek, EXPO.title);
    await expect(expo).toHaveCount(1);
    await expect(expo.getByRole("link", { name: `活動頁：${EXPO.title}（另開視窗）` })).toHaveAttribute("href", /tfam\.museum/);
    await expect(expo.getByText(new RegExp(`^展覽・${QUIET_CITY.short}・臺北市立美術館・展至 `))).toBeVisible();

    await tabs.getByRole("button", { name: "全部" }).tap();
    await expect(page.getByText("資料來源：文化部文化資料開放服務網")).toBeVisible();
    const credits = page.getByText(/^活動資料：/);
    await expect(credits).toBeVisible();
    await expect(credits.getByRole("link", { name: "臺北市立美術館" })).toHaveAttribute("href", "https://www.tfam.museum/");
    await expect(credits.getByRole("link", { name: /KKTIX|OPENTIX/ }).first()).toBeVisible();
    await shot(page, "all");
  });

  await test.step("排進行程：預填名稱、場地、場次時間 → 計畫中 → 日誌接下來", async () => {
    await tabs.getByRole("button", { name: "演出" }).tap();
    await card(thisWeek, ROCK.title).getByRole("button", { name: `排進行程：${ROCK.title}` }).tap();
    const sheet = page.getByRole("dialog", { name: "記一筆" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "演出名或展覽名" })).toHaveValue(ROCK.title);
    await expect(sheet.getByLabel("日期時間")).toHaveValue(`${ROCK.day}T${ROCK.time}`);
    await shot(page, "live-sheet");

    await sheet.getByRole("button", { name: "排進行程" }).click();
    await expect(page.getByText("散場誌・計畫")).toBeVisible();
    await expect(sheet).toBeHidden({ timeout: 10_000 });
    await skipPermissionPrompt(page);

    const entries = await rest<{ status: string; work_id: string; works: { title: string; venue: string | null; event_date: string | null } }>(
      "journal_entries",
      `select=status,work_id,works(title,venue,event_date)&user_id=eq.${userId}`,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: "planned", works: { title: ROCK.title, venue: ROCK.venue, event_date: ROCK.day } });
    accounts.trackWork(entries[0].work_id);

    await page.goto("/journal");
    await expect(page.getByRole("region", { name: "接下來" }).getByText(ROCK.title)).toBeVisible();
    await shot(page, "journal-upcoming");
  });
});
