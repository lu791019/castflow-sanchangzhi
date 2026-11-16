/**
 * P3 場外與印文：記一筆場外變體 → 場刊頁；設定換印文 → 印章更新。
 * 真走 magic link 登入；作品由 server 依名稱＋日期建立，文章以 service role 掛在測試使用者名下，結束時整批刪除。
 */

import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { patch, seedEpisode } from "./fixtures/p2-seed";
import { expect, test } from "./fixtures/test";

function todayDots(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${month}.${day}`;
}

interface WorkRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  venue: string | null;
  event_date: string | null;
  event_end_date: string | null;
  live_key: string | null;
}

test("記一筆場外 → 同名同日期歸入同一本 → 場刊頁", async ({ page, accounts }) => {
  const email = accounts.newEmail("p3venue-log");
  const penName = await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  const stamp = Date.now().toString(36);
  const name = `島嶼夜歌・草地音樂會 ${stamp}`;

  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await sheet.getByRole("radio", { name: "音樂祭/演出" }).click();
  await expect(sheet.getByText("哪一場")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "寫下演出名或展覽名" })).toBeVisible();
  await sheet.getByRole("textbox", { name: "演出名或展覽名" }).fill(name);
  await sheet.getByPlaceholder("哪個場館、哪片草地").fill("大佳河濱公園 草地舞台");
  await sheet.getByPlaceholder(/演出日或展期/).fill(todayDots());
  await sheet.getByRole("button", { name: "記下了" }).click();
  await expect(page.getByText("散場誌・場外")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(`記下了「${name}」`);

  // DB：日誌綁到新建的場外作品
  const [entry] = await rest<{ id: string; work_id: string; venue: string }>("journal_entries", `select=id,work_id,venue&user_id=eq.${userId}`);
  expect(entry.venue).toBe("live");
  accounts.trackWork(entry.work_id);
  const [work] = await rest<WorkRow>("works", `select=id,slug,kind,title,venue,event_date,event_end_date,live_key&id=eq.${entry.work_id}`);
  expect(work).toMatchObject({ kind: "live", title: name, venue: "大佳河濱公園 草地舞台", event_end_date: null });
  expect(work.live_key).toBe(`島嶼夜歌草地音樂會${stamp}`);

  // 同名（標點空白不同）＋日期重疊 → 同一本；展覽同名不混
  const again = await page.evaluate(
    async (body) => (await (await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()) as { programmeSlug: string },
    { experiencedAt: new Date().toISOString(), venue: "live", workTitle: "x", liveName: `島嶼夜歌 草地音樂會${stamp}！`, liveDates: `${todayDots()} – 12.31` },
  );
  expect(again.programmeSlug).toBe(work.slug);
  const other = await page.evaluate(
    async (body) => (await (await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()) as { programmeSlug: string },
    { experiencedAt: new Date().toISOString(), venue: "exhibition", workTitle: "x", liveName: name },
  );
  expect(other.programmeSlug).not.toBe(work.slug);
  const [exhibition] = await rest<{ id: string }>("works", `select=id&slug=eq.${other.programmeSlug}`);
  accounts.trackWork(exhibition.id);
  const bad = await page.evaluate(
    async (body) => (await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status,
    { experiencedAt: new Date().toISOString(), venue: "live", workTitle: "x", liveName: "x", liveDates: "下週六" },
  );
  expect(bad).toBe(400);

  // 說成一篇公開文章並連回那筆日誌 → 場刊頁出現
  const episodeId = await seedEpisode(userId, {
    title: "草地上的最後一首歌",
    workId: work.id,
    publishedAt: new Date().toISOString(),
    shareSlug: `p3v${stamp}`,
    visibility: "public",
    blog: {},
  });
  await patch("journal_entries", `id=eq.${entry.id}`, { episode_id: episodeId, status: "said" });

  await page.goto(`/works/${work.slug}`);
  await expect(page.getByText("場外・演出")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("島嶼夜歌・");
  await expect(page.getByRole("heading", { name: "這場散場的人" })).toBeVisible();
  await expect(page.getByRole("link", { name: `${penName}的專欄` })).toBeVisible();
  await expect(page.getByRole("img", { name: /已散場/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /草地上的最後一首歌/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /你也在/ })).toBeVisible();
  await expect(page.locator(`a[href="/say?work=${work.slug}"]`)).toContainText("說一段");
});

test("設定換印文 → 印章更新；回到依規則", async ({ page, accounts }) => {
  const email = accounts.newEmail("p3venue-seal");
  const penName = await loginAsNewUser(page, email, "/me/settings");
  const userId = await accounts.userIdOf(email);
  const second = Array.from(penName)[1];

  const group = page.getByRole("radiogroup", { name: "印文" });
  await waitForHydration(page, '[aria-labelledby="seal-glyph"] button');
  await group.getByRole("radio", { name: second, exact: true }).click();
  await expect(group.getByRole("radio", { name: second, exact: true })).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => (await rest<{ seal_glyph: string | null }>("profiles", `select=seal_glyph&id=eq.${userId}`))[0]?.seal_glyph)
    .toBe(second);
  const previews = page.getByTestId("seal-preview").locator("[data-seal-shape]");
  await expect(previews).toHaveCount(3);
  for (const index of [0, 1, 2]) await expect(previews.nth(index)).toContainText(second);

  await page.goto("/me");
  await expect(page.getByRole("img", { name: `${penName}的印章` })).toContainText(second);

  await page.goto("/me/settings");
  await waitForHydration(page, '[aria-labelledby="seal-glyph"] button');
  await page.getByRole("radiogroup", { name: "印文" }).getByRole("radio", { name: /依規則/ }).click();
  await expect
    .poll(async () => (await rest<{ seal_glyph: string | null }>("profiles", `select=seal_glyph&id=eq.${userId}`))[0]?.seal_glyph)
    .toBeNull();
});
