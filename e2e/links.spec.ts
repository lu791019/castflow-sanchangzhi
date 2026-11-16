/**
 * 散場之前：在哪看／去哪買票（記一筆場外手填、作品頁、告訴我們、接下來次鈕、匿名 401）。
 * 真走 magic link 登入；作品以 service role 建立，結束時整批刪除。
 */

import { rest } from "./fixtures/admin";
import { loginAsNewUser, waitForHydration } from "./fixtures/auth";
import { seedMovie, seedPlan } from "./fixtures/links-seed";
import { expect, test } from "./fixtures/test";

const SHOTS = "design/links-preview";

test("記一筆場外填場館類型與售票網址 → 場刊頁「去哪買票」連到該網址；接下來有次鈕", async ({ page, accounts }) => {
  const email = accounts.newEmail("links-live");
  await loginAsNewUser(page, email, "/me");
  const userId = await accounts.userIdOf(email);
  const stamp = Date.now().toString(36);
  const name = `落日飛車巡迴 ${stamp}`;
  const ticketUrl = `https://kktix.com/events/e2e-${stamp}`;

  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await sheet.getByRole("radio", { name: "音樂祭/演出" }).click();
  await sheet.getByRole("textbox", { name: "演出名或展覽名" }).fill(name);
  await sheet.getByPlaceholder("哪個場館、哪片草地").fill("Legacy Taipei");
  const types = sheet.getByRole("radiogroup", { name: "場館類型" });
  await expect(types.getByRole("radio")).toHaveText(["音樂廳", "劇場", "Live House", "音樂祭", "體育館"]);
  await types.getByRole("radio", { name: "Live House" }).click();
  await sheet.getByPlaceholder("售票網址（選填）").fill(ticketUrl);
  await sheet.getByPlaceholder("售票網址（選填）").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}-live-fields.png` });
  // 展覽那一層的類型不同
  await sheet.getByRole("radio", { name: "展覽" }).click();
  await expect(types.getByRole("radio")).toHaveText(["美術館", "博物館", "藝廊", "特展"]);
  await sheet.getByRole("radio", { name: "音樂祭/演出" }).click();
  await expect(types.getByRole("radio", { name: "Live House" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "記下了" }).click();
  // toast 只停 4 秒，高負載時容易錯過；改等 DB 寫入
  await expect.poll(async () => (await rest("journal_entries", `select=id&user_id=eq.${userId}`)).length, { timeout: 20_000 }).toBe(1);

  const [entry] = await rest<{ work_id: string }>("journal_entries", `select=work_id&user_id=eq.${userId}`);
  accounts.trackWork(entry.work_id);
  const [work] = await rest<{ slug: string; venue_type: string }>("works", `select=slug,venue_type&id=eq.${entry.work_id}`);
  expect(work.venue_type).toBe("livehouse");
  const links = await rest<{ kind: string; source: string; origin: string; url: string; added_by: string }>(
    "work_links",
    `select=kind,source,origin,url,added_by&work_id=eq.${entry.work_id}`,
  );
  expect(links).toEqual([{ kind: "ticket", source: "kktix", origin: "manual", url: ticketUrl, added_by: userId }]);

  await page.goto(`/works/${work.slug}`);
  const box = page.getByRole("navigation", { name: "售票與官網" });
  await expect(page.getByRole("heading", { name: "去哪買票" })).toBeVisible();
  await expect(box.getByRole("link").first()).toHaveAttribute("href", ticketUrl);
  // venue_type Live House → 搜尋連結 Accupass 在拓元前；KKTIX 搜尋被手填的取代
  await expect(box.getByRole("link")).toHaveCount(3);
  await expect(box.getByRole("link").nth(1)).toContainText("Accupass");
  await page.getByRole("heading", { name: "去哪買票" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}-programme.png` });

  // 接下來：計畫中的這一場，右側次鈕「去哪買票」連到手填網址
  const plan = await seedPlan(userId, entry.work_id, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  expect(plan.id).toBeTruthy();
  await page.goto("/journal");
  const upcoming = page.getByRole("region", { name: "接下來" });
  const button = upcoming.getByRole("link", { name: "去哪買票" });
  await expect(button).toHaveAttribute("href", ticketUrl);
  await upcoming.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}-upcoming.png` });
});

test("電影作品頁：有 TMDB 快照出現在哪看；沒有時給搜尋連結，登入者告訴我們 → 立刻顯示", async ({ page, accounts }) => {
  const stamp = Date.now().toString(36);
  const tmdbLink = "https://www.themoviedb.org/movie/1/watch?locale=TW";
  const withSnapshot = await seedMovie(`有快照的電影 ${stamp}`, `e2e-links-a-${stamp}`, {
    providers: [{ name: "Netflix", kind: "subscription", link: tmdbLink }],
    link: tmdbLink,
    releaseDate: "2024-01-01",
  });
  accounts.trackWork(withSnapshot.id);
  const bare = await seedMovie(`沒資料的電影 ${stamp}`, `e2e-links-b-${stamp}`, null);
  accounts.trackWork(bare.id);

  await page.goto(`/works/${withSnapshot.slug}`);
  // 換頁骨架串流時，隱藏的串流片段會短暫留一份同樣的內容：只看 main 裡的
  const platforms = page.getByRole("main").getByRole("navigation", { name: "串流平台" });
  await expect(platforms.getByRole("link", { name: /Netflix/ })).toHaveAttribute("href", tmdbLink);
  await expect(page.getByRole("main").getByText("資料來源：JustWatch / TMDB")).toBeVisible();

  // 匿名：看得到搜尋連結；POST 401
  await page.goto(`/works/${bare.slug}`);
  const search = page.getByRole("navigation", { name: "搜尋平台" });
  await expect(search.getByRole("link", { name: /JustWatch/ })).toHaveAttribute(
    "href",
    `https://www.justwatch.com/tw/search?q=${encodeURIComponent(`沒資料的電影 ${stamp}`)}`,
  );
  // 換頁骨架串流時，隱藏的串流片段會短暫留一份同樣的內容：只看 main 裡的
  await expect(page.getByRole("main").getByText("這部目前查不到線上平台。")).toBeVisible();
  const anonymous = await page.request.post(`/api/works/${bare.id}/links`, {
    data: { kind: "watch", url: "https://www.netflix.com/title/1" },
  });
  expect(anonymous.status()).toBe(401);

  const email = accounts.newEmail("links-tell");
  await loginAsNewUser(page, email, `/works/${bare.slug}`);
  const userId = await accounts.userIdOf(email);
  await expect(page).toHaveURL(new RegExp(`/works/${bare.slug}`));
  await waitForHydration(page, "form, button");
  await page.getByRole("button", { name: "你知道？告訴我們" }).click();
  await page.getByPlaceholder(/貼上網址/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "送出" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("網址要是 http 或 https 開頭");
  await page.getByPlaceholder(/貼上網址/).fill("https://www.netflix.com/title/80057281");
  await page.getByPlaceholder(/貼上網址/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}-tell-us.png` });
  await page.getByRole("button", { name: "送出" }).click();
  const added = page.getByRole("main").getByRole("navigation", { name: "串流平台" }).getByRole("link", { name: /Netflix/ });
  await expect(added).toHaveAttribute("href", "https://www.netflix.com/title/80057281");
  await expect(added).toContainText("讀者補充");
  await expect(page.getByRole("button", { name: "你知道？告訴我們" })).toHaveCount(0);
  await expect(page.getByText("台灣地區・JustWatch")).toHaveCount(0);
  await added.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}-work-page.png` });

  const [row] = await rest<{ origin: string; added_by: string; status: string }>(
    "work_links",
    `select=origin,added_by,status&work_id=eq.${bare.id}`,
  );
  expect(row).toEqual({ origin: "user", added_by: userId, status: "active" });

  // 白名單外 → 202 待審，不公開
  const pending = await page.evaluate(
    async (id) =>
      (await fetch(`/api/works/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "watch", url: "https://example.org/x" }),
      })).status,
    bare.id,
  );
  expect(pending).toBe(202);
  const publicRows = await page.evaluate(async (id) => (await (await fetch(`/api/works/${id}/links`)).json()) as { data: { watch: Array<{ source: string }> } }, bare.id);
  expect(publicRows.data.watch.map((link) => link.source)).not.toContain("web:example.org");
});

test("記一筆選定作品後，作品列下方出現在哪看；本週熱門每列有次鈕", async ({ page, accounts }) => {
  const stamp = Date.now().toString(36);
  const tmdbLink = "https://www.themoviedb.org/movie/2/watch?locale=TW";
  const movie = await seedMovie(`記一筆的電影 ${stamp}`, `e2e-links-c-${stamp}`, {
    providers: [{ name: "Catchplay", kind: "rent", link: tmdbLink }],
    link: tmdbLink,
    releaseDate: "2024-01-01",
  });
  accounts.trackWork(movie.id);
  const email = accounts.newEmail("links-sheet");
  await loginAsNewUser(page, email, "/me");

  // 本週熱門（面板空狀態）：每列右側次鈕
  await page.route("**/api/works/trending**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          kind: "series",
          fetchedAt: new Date().toISOString(),
          sections: [
            {
              key: "trending",
              title: "本週熱門",
              items: [
                { kind: "series", tmdbId: 66732, title: "怪奇物語", originalTitle: "Stranger Things", year: 2016, region: "美國", posterUrl: null, feelingCount: 0 },
                { kind: "series", tmdbId: 1, title: "不在映射裡的劇", originalTitle: null, year: 2026, region: null, posterUrl: null, feelingCount: 0 },
              ],
            },
          ],
        },
      },
    }),
  );
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await sheet.getByRole("button", { name: "搜尋作品" }).click();
  const picker = page.getByRole("dialog", { name: /這篇在說哪一部？|選擇作品/ });
  const netflix = picker.getByRole("link", { name: "怪奇物語：Netflix" });
  await expect(netflix).toHaveAttribute("href", "https://www.netflix.com/title/80057281");
  await expect(picker.getByRole("link", { name: "不在映射裡的劇：在哪看" })).toHaveAttribute(
    "href",
    "https://www.themoviedb.org/tv/1/watch?locale=TW",
  );
  await page.screenshot({ path: `${SHOTS}-trending.png` });
  await page.keyboard.press("Escape");

  // 記一筆：選了作品（經 API 選定 → 最近），作品列下方出現在哪看
  await page.evaluate(async (id) => {
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId: id, experiencedAt: new Date(Date.now() - 3600_000).toISOString(), venue: "home" }),
    });
  }, movie.id);
  await page.reload();
  await waitForHydration(page, 'button[aria-label="記一筆"]');
  await page.getByRole("button", { name: "記一筆", exact: true }).click();
  const sheet2 = page.getByRole("dialog", { name: "記一筆" });
  await sheet2.getByRole("radio", { name: new RegExp(`記一筆的電影 ${stamp}`) }).click();
  const watch = sheet2.getByLabel("在哪看");
  await expect(watch.getByRole("link", { name: /Catchplay/ })).toHaveAttribute("href", tmdbLink);
  await page.screenshot({ path: `${SHOTS}-log-sheet.png` });
});
