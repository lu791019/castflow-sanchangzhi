/**
 * 體驗流暢度 HIGH 修正（uxfix，10/14）：
 * - UX-03 訪客記一筆按「記下了」→ 登入 → 回來 sheet 還原「剛剛填的還在」→ 記下（觸控 tap）
 * - UX-02 錄不到人聲（逐字稿只有「.」）不送整理；正文是【無法生成】的舊草稿不給發佈
 * - UX-04 我的只列已發佈，草稿數在編輯檯列
 * - UX-07 說一段第一張作品卡是剛記、還沒說的那筆，不預選沒綁作品的舊錄音
 */

import { rest } from "./fixtures/admin";
import { completePenName, loginAsNewUser, submitLoginAndFollowLink, waitForHydration } from "./fixtures/auth";
import { expect, test, type Accounts } from "./fixtures/test";
import { seedTestWork, type SeededWork } from "./fixtures/works-seed";
import { seedEpisode, seedRecordedEntry } from "./fixtures/uxfix-seed";

test.use({ hasTouch: true, isMobile: true });

async function pickMovie(accounts: Accounts): Promise<SeededWork> {
  return seedTestWork(accounts, "uxfix");
}

test("UX-03 訪客記一筆：送出要登入 → 登入回來剛剛填的還在 → 記下", async ({ page, accounts }) => {
  const liveName = `uxfix 演出 ${Date.now().toString(36)}`;
  await page.goto("/");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).tap();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: "音樂祭/演出" }).tap();
  await sheet.getByPlaceholder("演出名或展覽名").fill(liveName);
  await sheet.getByPlaceholder("一個人、和姊姊……").fill("和姊姊");
  await sheet.getByRole("button", { name: "記下了" }).tap();

  // 401 → 登入頁：next 帶 resume，並說明剛剛填的會留著
  await expect(page).toHaveURL(/\/login\?next=%2Fjournal%2Fnew%3Fresume%3D1/);
  await expect(page.getByText("剛剛記一筆填的會先留著，登入後接著記。")).toBeVisible();
  const draft = await page.evaluate(() => window.localStorage.getItem("castflow-log-draft"));
  expect(draft).toContain(liveName);

  const email = accounts.newEmail("guestlog");
  await submitLoginAndFollowLink(page, email);
  await completePenName(page);
  await expect(page).toHaveURL(/\/journal\/new\?resume=1/);

  const restored = page.getByRole("dialog", { name: "記一筆" });
  await expect(restored.getByRole("status")).toHaveText("剛剛填的還在，確認後按下去就記好了。");
  await expect(restored.getByPlaceholder("演出名或展覽名")).toHaveValue(liveName);
  await expect(restored.getByPlaceholder("一個人、和姊姊……")).toHaveValue("和姊姊");
  await page.screenshot({ path: "design/uxfix-preview-log-restored.png" });
  await restored.getByRole("button", { name: "記下了" }).tap();
  await expect(restored).toBeHidden({ timeout: 15_000 });

  const userId = await accounts.userIdOf(email);
  const entries = await rest<{ work_title_fallback: string; venue: string; companions: string }>(
    "journal_entries",
    `select=work_title_fallback,venue,companions&user_id=eq.${userId}`,
  );
  expect(entries).toEqual([{ work_title_fallback: liveName, venue: "live", companions: "和姊姊" }]);
  expect(await page.evaluate(() => window.localStorage.getItem("castflow-log-draft"))).toBeNull();
});

test("UX-02 逐字稿只有「.」不送整理；【無法生成】舊草稿不能確認發佈", async ({ page, accounts }) => {
  const email = accounts.newEmail("refuse");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);

  const unheard = await seedEpisode(userId, { transcript: "." });
  await page.goto(`/proof/${unheard}`);
  await expect(page.getByRole("heading", { name: "沒聽清楚。" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("再說一次，或改用打的。")).toBeVisible();
  await expect(page.getByRole("link", { name: "改用打的" })).toHaveAttribute("href", "/say?mode=text");
  await page.screenshot({ path: "design/uxfix-preview-not-heard.png" });
  // 沒有送去整理：不會長出正文
  expect(await rest("contents", `select=id&episode_id=eq.${unheard}`)).toEqual([]);

  const refused = await seedEpisode(userId, {
    transcript: "嗯……那個……我覺得今天的電影很好看很好看",
    blogBody: "【無法生成】收到的逐字稿只有一個「.」，請提供完整的 Podcast 逐字稿後再重新產生。",
  });
  await page.goto(`/proof/${refused}`);
  await expect(page.getByRole("heading", { name: "文字在，但這次沒整理好。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "再整理一版" })).toBeVisible();
  await expect(page.getByRole("link", { name: "改用打的" })).toBeVisible();
  await expect(page.getByRole("button", { name: /確認發佈/ })).toHaveCount(0);
  await expect(page.getByText("【無法生成】")).toHaveCount(0);
  await page.screenshot({ path: "design/uxfix-preview-refused.png" });
});

test("UX-04 我的只列已發佈；草稿數在編輯檯，不連舊編輯器", async ({ page, accounts }) => {
  const movie = await pickMovie(accounts);
  const email = accounts.newEmail("me");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  const slug = `ux${Date.now().toString(36)}`.slice(0, 10);
  await seedEpisode(userId, {
    source: "text",
    title: "發佈的那篇",
    blogBody: "# 燈亮的時候\n\n我哭了很久。",
    workId: movie.id,
    shareSlug: slug,
    publishedAt: new Date().toISOString(),
  });
  await seedEpisode(userId, { title: "散場隨筆", blogBody: "# 還沒發的草稿\n\n內文。" });

  await page.goto("/me");
  const list = page.locator("section", { has: page.getByRole("heading", { name: "發表過的感受" }) });
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list.getByRole("link", { name: /燈亮的時候/ })).toHaveAttribute("href", `/s/${slug}`);
  await expect(list.getByText("還沒發的草稿")).toHaveCount(0);
  await expect(page.getByText("1 篇", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /編輯檯.*1 份草稿/ })).toBeVisible();
  await expect(page.locator('a[href*="/edit"]')).toHaveCount(0);
  await page.screenshot({ path: "design/uxfix-preview-me.png", fullPage: true });
});

test("UX-07 說一段第一張卡是剛記、還沒說的那筆；不預選沒綁作品的舊錄音", async ({ page, accounts }) => {
  const movie = await pickMovie(accounts);
  const email = accounts.newEmail("saycard");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  await seedEpisode(userId, { title: "散場隨筆", transcript: "舊的錄音內容，舊的錄音內容" });
  const entryId = await seedRecordedEntry(userId, movie.id, 1);

  await page.goto("/say");
  await expect(page.getByText(`剛看完《${movie.title}》`)).toBeVisible();
  await expect(page.getByText("來自你的視聽日誌")).toBeVisible();
  await expect(page.getByText("散場隨筆")).toHaveCount(0);
  await page.screenshot({ path: "design/uxfix-preview-say-card.png" });

  // 與散場提醒深連結一致：/say?journal=<id> 同一張卡，不重複
  await page.goto(`/say?journal=${entryId}`);
  await expect(page.getByText(`剛看完《${movie.title}》`)).toBeVisible();

  // 打字太短：不送出，提示多寫幾句（Q-54：打字也是一等公民）
  await page.getByRole("button", { name: "用打的" }).tap();
  await page.getByRole("textbox").fill("好看");
  await page.getByRole("button", { name: "幫我整理成一篇" }).tap();
  await expect(page.getByText("再多寫幾句，至少 10 個字才整理得成一篇。")).toBeVisible();
});

test("記一筆「現在就想說」：導去說一段後 sheet 收起，不蓋在說一段上（tour 回報）", async ({ page, accounts }) => {
  const movie = await pickMovie(accounts);
  const email = accounts.newEmail("saynow");
  await loginAsNewUser(page, email, "/journal");
  const userId = await accounts.userIdOf(email);
  await seedRecordedEntry(userId, movie.id, 30);

  // 沒選完：直接去說一段
  await page.goto("/journal");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).tap();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "現在就想說" }).tap();
  await expect(page).toHaveURL(/\/say$/, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await expect(sheet).toBeHidden();

  // 選好作品與地點：先記下再帶這筆去說一段
  await page.goto("/journal");
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).tap();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: new RegExp(movie.title) }).first().tap();
  await sheet.getByRole("radio", { name: "電影院" }).tap();
  await sheet.getByRole("button", { name: "現在就想說" }).tap();
  await expect(page).toHaveURL(/\/say\?journal=/, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await expect(sheet).toBeHidden();
  await expect(page.getByText(`剛看完《${movie.title}》`)).toBeVisible();
});

test("Q-55／UX-22 發佈成功頁不放社群貼文、印章寫散場誌；編輯檯有產出的那篇才有「社群貼文」小連結", async ({ page, accounts }) => {
  const email = accounts.newEmail("desk");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  const slug = `ds${Date.now().toString(36)}`.slice(0, 10);
  const withSocial = await seedEpisode(userId, {
    source: "text",
    title: "有社群貼文的那篇",
    blogBody: "# 有社群貼文的那篇\n\n內文。",
    shareSlug: slug,
    publishedAt: new Date().toISOString(),
    socialPosts: true,
  });
  await seedEpisode(userId, { source: "text", title: "只有正文的草稿", blogBody: "# 只有正文的草稿\n\n內文。" });

  await page.goto(`/proof/${withSocial}`);
  await expect(page.getByText("已發佈")).toBeVisible();
  await expect(page.getByText("散場誌", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CASTFLOW")).toHaveCount(0);
  await expect(page.getByText(/6 個平台的社群貼文/)).toHaveCount(0);
  await page.screenshot({ path: "design/uxfix-preview-published.png" });

  await page.goto("/me/desk?tab=published");
  await expect(page.getByRole("link", { name: "社群貼文：有社群貼文的那篇" })).toHaveAttribute("href", `/episodes/${withSocial}/edit`);
  await page.screenshot({ path: "design/uxfix-preview-desk.png" });
  await page.getByRole("tab", { name: /草稿/ }).tap();
  await expect(page.getByText("只有正文的草稿")).toBeVisible();
  await expect(page.getByRole("link", { name: /^社群貼文：/ })).toHaveCount(0);
});
