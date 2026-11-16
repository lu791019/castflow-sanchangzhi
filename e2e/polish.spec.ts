/**
 * 日期格記一筆、海報、動效（polish）：
 * - 日誌月曆：沒有紀錄的過去格 → 記一筆預填該日 20:00 → 記下；未來格 → 排進行程；有紀錄的格展開清單＋「＋ 記一筆」
 * - 記一筆 sheet 拖曳：拖 60px 放開回彈、拖 200px 放開收起
 * - 目錄：綁了有海報作品的文章放海報；寬螢幕索引「這週被說起的」縮圖接海報
 * POLISH_SHOTS=1 時輸出 375 寬截圖到 design/polish-*.png。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";
import { seedPublished } from "./fixtures/og-seed";
import { createAuthor } from "./fixtures/p3idx-seed";
import { seedTestWork } from "./fixtures/works-seed";

const SHOTS = process.env.POLISH_SHOTS === "1";
const HOUR = 60 * 60 * 1000;

// 錄影只給「動效巡覽」用；整檔共用一個 worker，只能放最上層
test.use({ video: SHOTS ? { mode: "on", size: { width: 375, height: 812 } } : "off" });

async function shot(page: Page, name: string, focus?: Locator): Promise<void> {
  if (!SHOTS) return;
  if (focus) await focus.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `design/polish-${name}.png` });
}

/** 台北日曆日 YYYY-MM-DD */
function taipeiDay(date: Date): string {
  return new Date(date.getTime() + 8 * HOUR).toISOString().slice(0, 10);
}

function cellName(dateKey: string): RegExp {
  const [, month, day] = dateKey.split("-").map(Number);
  return new RegExp(`^${month} 月 ${day} 日，`);
}

/** 本月中「不是今天」的過去日與未來日（月初或月底當天就沒有該側） */
function emptyDays(today: string): { past: string | null; future: string | null } {
  const [year, month, day] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const key = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { past: day > 1 ? key(1) : null, future: day < last ? key(last) : null };
}

async function dismissPermissionGuide(page: Page): Promise<void> {
  await page.waitForURL(/\/notifications\/enable\?entry=/, { timeout: 3_000 }).catch(() => undefined);
  if (/notifications\/enable/.test(page.url())) {
    await page.getByRole("button", { name: "先不用" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/notifications"), { timeout: 30_000 });
  }
}

/** repeat：同一部 2 小時內記過（開頭用 API 種的那筆），sheet 會先確認一次（UX-26） */
async function fillAndSubmit(sheet: Locator, movieTitle: string, action: "記下了" | "排進行程", repeat = false): Promise<void> {
  await sheet.getByRole("radio", { name: movieTitle }).click();
  await sheet.getByRole("radio", { name: "電影院" }).click();
  await sheet.getByRole("button", { name: action }).click();
  if (repeat) await sheet.getByRole("alertdialog", { name: "再記一筆確認" }).getByRole("button", { name: "再記一筆" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function dragHandle(page: Page, distance: number): Promise<void> {
  const box = await page.locator("[data-sheet-handle] h1").boundingBox();
  if (!box) throw new Error("[e2e polish] 找不到 sheet 標題列");
  const x = box.x + 8;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(x, y + (distance * step) / 8);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(80);
  await page.mouse.up();
}

test("日誌月曆點日期格記一筆（過去記下、未來排進行程、展開清單＋記一筆）＋sheet 拖曳", async ({ page, accounts }) => {
  const movie = await seedTestWork(accounts, "cal");

  const email = accounts.newEmail("cal");
  await loginAsNewUser(page, email, "/journal");
  await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  const userId = await accounts.userIdOf(email);

  // 先記一筆今天的，月曆才會出現（空月份是稿紙格）
  const seed = await page.request.post("/api/journal", {
    data: { workId: movie.id, experiencedAt: new Date().toISOString(), venue: "home" },
  });
  expect(seed.status()).toBe(201);

  const today = taipeiDay(new Date());
  const { past, future } = emptyDays(today);
  await page.goto("/journal");
  const sheet = page.getByRole("dialog", { name: "記一筆" });

  if (past) {
    const cell = page.getByRole("button", { name: cellName(past) });
    await waitForHydration(page, `button[aria-label^="${Number(past.slice(5, 7))} 月 1 日"]`);
    await expect(cell).toHaveAccessibleName(/記一筆$/);
    await shot(page, "a1-calendar");
    await cell.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "選日期時間" })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByLabel("日期時間")).toHaveValue(`${past}T20:00`);
    await shot(page, "a1-sheet-past");
    await fillAndSubmit(sheet, movie.title, "記下了", true);
    await dismissPermissionGuide(page);
    const [entry] = await rest<{ status: string; experienced_at: string }>(
      "journal_entries",
      `select=status,experienced_at&user_id=eq.${userId}&experienced_at=lt.${past}T23:59:59%2B08:00&experienced_at=gte.${past}T00:00:00%2B08:00`,
    );
    expect(entry.status).toBe("recorded");
    expect(new Date(entry.experienced_at).toISOString()).toBe(new Date(`${past}T20:00:00+08:00`).toISOString());
  }

  if (future) {
    await page.goto("/journal");
    const cell = page.getByRole("button", { name: cellName(future) });
    await expect(cell).toHaveAccessibleName(/排進行程$/);
    await waitForHydration(page, `button[aria-label^="${Number(future.slice(5, 7))} 月 ${Number(future.slice(8))} 日"]`);
    await cell.click();
    await expect(sheet.getByLabel("日期時間")).toHaveValue(`${future}T20:00`);
    await expect(sheet.getByRole("button", { name: "選作品與在哪裡" })).toBeVisible();
    await fillAndSubmit(sheet, movie.title, "排進行程");
    await dismissPermissionGuide(page);
    await expect
      .poll(async () => (await rest<{ status: string }>("journal_entries", `select=status&user_id=eq.${userId}&status=eq.planned`)).length)
      .toBe(1);
  }

  // 有紀錄的格（今天）：維持展開清單，標頭多「＋ 記一筆」；今天不預填（維持剛剛）
  await page.goto("/journal");
  await page.getByRole("link", { name: cellName(today) }).click();
  const day = page.getByRole("region", { name: `${today} 的紀錄` });
  await expect(day).toBeVisible();
  await waitForHydration(page, `section[aria-label="${today} 的紀錄"] button`);
  await shot(page, "a1-day-list", day);
  await day.getByRole("button", { name: "＋ 記一筆" }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "剛剛" })).toHaveAttribute("aria-checked", "true");

  // C：拖 60px 放開回彈；拖 200px 放開收起
  await page.waitForTimeout(400);
  await dragHandle(page, 60);
  await page.waitForTimeout(400);
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.evaluate((node) => getComputedStyle(node).translate)).toMatch(/^(none|0px)$/);
  await dragHandle(page, 200);
  await expect(sheet).toBeHidden({ timeout: 5_000 });
});

test("空月份（還沒有任何紀錄）的稿紙格也能點：過去格記一筆、下個月的格排進行程", async ({ page, accounts }) => {
  const email = accounts.newEmail("calempty");
  await loginAsNewUser(page, email, "/journal");
  await expect(page).toHaveURL(/\/journal$/, { timeout: 30_000 });
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(page.getByRole("heading", { name: /這個月的第一筆/ })).toBeVisible();

  const today = taipeiDay(new Date());
  const { past } = emptyDays(today);
  if (past) {
    const cell = page.getByRole("button", { name: cellName(past) });
    await waitForHydration(page, `button[aria-label^="${Number(past.slice(5, 7))} 月 1 日"]`);
    await expect(cell).toHaveAccessibleName(/記一筆$/);
    await shot(page, "a1-empty-month");
    await cell.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("日期時間")).toHaveValue(`${past}T20:00`);
    await sheet.getByRole("button", { name: "關閉" }).click();
    await expect(sheet).toBeHidden({ timeout: 10_000 });
  }

  const [year, month] = today.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const futureDay = `${next}-15`;
  await page.goto(`/journal?month=${next}`);
  const cell = page.getByRole("button", { name: cellName(futureDay) });
  await waitForHydration(page, `button[aria-label^="${Number(next.slice(5))} 月 15 日"]`);
  await expect(cell).toHaveAccessibleName(/排進行程$/);
  await cell.click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("日期時間")).toHaveValue(`${futureDay}T20:00`);
});

test("目錄與索引放作品海報", async ({ page, accounts }) => {
  // 自己種一篇綁了海報作品的公開文章（不依賴 DB 既有資料）
  const poster = "https://image.tmdb.org/t/p/w185/gH7sCqC8bQGEic48txWcMUdomuU.jpg";
  const work = await seedTestWork(accounts, "poster", { posterUrl: poster });
  const authorId = await createAuthor(accounts.newEmail("poster-author"), `海報${Date.now().toString(36).slice(-6)}`);
  const slug = await seedPublished(authorId, {
    workId: work.id,
    title: `看完有海報的那部 ${work.slug}`,
    lede: "散場之後走回車站的路上。",
    pullQuote: "燈亮了，我還坐著。",
    saidAt: new Date().toISOString(),
  });
  const works = { poster_url: poster };

  const email = accounts.newEmail("poster");
  await loginAsNewUser(page, email, "/?tab=all");
  await page.goto("/?tab=all");
  const entry = page.locator(`a[href="/s/${slug}"]`).first();
  await expect(entry).toBeVisible();
  await expect(entry.locator("img")).toHaveAttribute("src", works.poster_url);
  await shot(page, "a2-feed");

  // 寬螢幕：本期焦點與右欄索引
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?tab=all");
  const index = page.getByRole("complementary", { name: "索引" });
  await expect(index.getByText("這週被說起的")).toBeVisible();
  await expect(index.locator("img").first()).toHaveAttribute("src", /image\.tmdb\.org/);
  if (SHOTS) await page.screenshot({ path: "design/polish-a2-feed-1280.png" });

  // 減少動態：換分頁只剩透明度，焦點海報不放大
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?tab=all");
  const animationOf = (selector: string) => page.locator(selector).first().evaluate((node) => getComputedStyle(node).animationName);
  await expect.poll(() => animationOf(".p4-tab-shift")).toBe("p4-fade-in");
  await expect.poll(() => animationOf(".p4-poster-in")).toBe("p4-fade-in");
});

/** 動效巡覽（只在 POLISH_SHOTS=1 錄影）：散場之前卡片浮現與按壓 → 換分頁 → 目錄焦點海報 → 記一筆 sheet 拖曳 */
test("動效巡覽", async ({ page, accounts }) => {
  test.skip(!SHOTS, "只在 POLISH_SHOTS=1 錄影");
  const email = accounts.newEmail("motion");
  await loginAsNewUser(page, email, "/before");
  // 先把四格各開一次（dev 編譯），錄到的換頁才是真的動效而不是等編譯
  for (const path of ["/?tab=all", "/journal", "/me", "/before"]) await page.goto(path);
  await page.waitForTimeout(800);
  const card = page.getByRole("article").first();
  if (await card.count()) {
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 40);
      await page.mouse.down();
      await page.waitForTimeout(300);
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
  }
  // 手機底部導覽（寬螢幕的刊頭導覽同名但隱藏）
  const nav = page.locator('nav[aria-label="主要導覽"]:visible');
  const tabs: ReadonlyArray<[string, RegExp]> = [
    ["目錄", /\/\?tab=all$/],
    ["日誌", /\/journal$/],
    ["我的", /\/me$/],
    ["散場之前", /\/before$/],
    ["目錄", /\/\?tab=all$/],
  ];
  for (const [label, url] of tabs) {
    // 第一次進日誌會有圓鈕提示泡泡蓋住導覽，直接派送 click（仍走 Link 的 client 換頁）
    await nav.getByRole("link", { name: label, exact: true }).dispatchEvent("click");
    await page.waitForURL(url, { timeout: 30_000 });
    await page.waitForTimeout(900);
  }
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  await page.waitForTimeout(600);
  await dragHandle(page, 70);
  await page.waitForTimeout(700);
  await dragHandle(page, 220);
  await page.waitForTimeout(800);
  await page.close();
  const video = page.video();
  if (video) await video.saveAs("design/polish-motion.webm");
});
