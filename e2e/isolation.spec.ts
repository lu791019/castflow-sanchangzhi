/** 使用者資料隔離：B 看不到 A 的校樣、集數、最近作品與視聽日誌（先確認 A 自己看得到，避免「本來就空」的假綠） */

import type { APIRequestContext } from "@playwright/test";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";
import { seedTestWork } from "./fixtures/works-seed";

const GENERATE_TIMEOUT_MS = 90_000;

interface RecentResponse {
  success: boolean;
  data: { recent: unknown[] };
}

interface JournalResponse {
  entries: unknown[];
}

async function getJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path);
  expect(response.status(), `${path} 應回 200`).toBe(200);
  return (await response.json()) as T;
}

test("使用者 B 看不到使用者 A 的文章、最近作品與日誌", async ({ page, browser, accounts }) => {
  const work = await seedTestWork(accounts, "iso");

  // A：登入 → 打字說一段（綁作品）→ 校樣；再記一筆視聽日誌
  await loginAsNewUser(page, accounts.newEmail("iso-a"), `/say?work=${work.slug}`);
  await expect(page).toHaveURL(new RegExp(`/say\\?work=${work.slug}$`));
  await waitForHydration(page, 'button[aria-label="按住說話"]');
  await page.getByRole("button", { name: "用打的" }).click();
  await page.locator("#say-text").fill(`E2E 隔離測試：只有作者自己看得到這篇。${Date.now()}`);
  await page.getByRole("button", { name: "幫我整理成一篇" }).click();
  await page.waitForURL(/\/proof\/[0-9a-f-]{36}$/, { timeout: GENERATE_TIMEOUT_MS });
  const episodeId = page.url().split("/proof/")[1];

  const journal = await page.request.post("/api/journal", {
    data: { workId: work.id, experiencedAt: new Date().toISOString(), venue: "home" },
  });
  expect(journal.status()).toBe(201);

  // 正對照：A 自己看得到
  expect((await page.goto(`/episodes/${episodeId}`))?.status()).toBe(200);
  expect((await getJson<RecentResponse>(page.request, "/api/works")).data.recent.length).toBeGreaterThan(0);
  expect((await getJson<JournalResponse>(page.request, "/api/journal")).entries.length).toBeGreaterThan(0);

  // B：另一個 browser context（不共用 cookie）
  const contextB = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const pageB = await contextB.newPage();
    await loginAsNewUser(pageB, accounts.newEmail("iso-b"), "/me");

    expect((await pageB.goto(`/proof/${episodeId}`))?.status()).toBe(404);
    expect((await pageB.goto(`/episodes/${episodeId}`))?.status()).toBe(404);

    const recent = await getJson<RecentResponse>(pageB.request, "/api/works");
    expect(recent).toMatchObject({ success: true, data: { recent: [] } });

    const journalB = await getJson<JournalResponse>(pageB.request, "/api/journal");
    expect(journalB.entries).toEqual([]);
  } finally {
    await contextB.close();
  }
});
