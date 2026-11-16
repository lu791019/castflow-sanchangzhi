import { generateMagicLinkTokenHash } from "./fixtures/admin";
import { BASE_URL, isRemoteE2E, REMOTE_NO_MAIL_REASON } from "./fixtures/env";
import { completePenName, submitLoginAndFollowLink } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";

test.describe("登入", () => {
  test("未登入開 /me 會導去登入並帶 next", async ({ page }) => {
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login\?next=%2Fme$/);
    await expect(page.getByRole("button", { name: "寄連結給我" })).toBeVisible();
  });

  test("magic link 登入 → 取筆名 → 我的 → 登出", async ({ page, accounts }) => {
    const email = accounts.newEmail("auth");

    await page.goto("/me");
    await submitLoginAndFollowLink(page, email);

    // 第一次登入：先取筆名，next 一路帶著
    await expect(page).toHaveURL(/\/onboarding\/pen-name\?next=%2Fme/);
    const penName = await completePenName(page);

    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { level: 1, name: penName })).toBeVisible();

    // 登入者首屏是散場之前：裸 `/` 轉到 /before；帶 tab 參數才看目錄；底部導覽第一格是散場之前
    await page.goto("/");
    await expect(page).toHaveURL(/\/before$/);
    const nav = page.getByRole("navigation", { name: "主要導覽" }).first();
    await expect(nav.getByRole("link").first()).toHaveText("散場之前");
    await expect(nav.getByRole("link", { name: "散場之前" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "目錄" }).click();
    await expect(page).toHaveURL(/\/\?tab=all$/);
    await expect(page.getByRole("heading", { level: 1, name: /散場之後/ })).toBeVisible();

    await page.goto("/me");
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 登出後再開 /me 又被擋回登入
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login\?next=%2Fme$/);
  });

  test("頁面還沒 hydrate 就打 email，送出時不會被清空", async ({ page, accounts }) => {
    // 這條要真的按「寄連結給我」並看到「去信箱」：會寄信
    test.skip(isRemoteE2E(), REMOTE_NO_MAIL_REASON);
    const email = accounts.newEmail("prehydrate");
    // 延遲前端 JS，讓輸入發生在 React hydrate 之前（模擬慢網路）
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // 只卡 JS：CSS 本來就擋首屏繪製，一起卡住只會測到「沒有樣式」而不是「還沒 hydrate」
    await page.route("**/_next/static/chunks/**/*.js", async (route) => {
      await gate;
      await route.continue();
    });

    // 只等 HTML 開始回應（domcontentloaded 會等被卡住的腳本）
    await page.goto("/login?next=%2Fme", { waitUntil: "commit" });
    const input = page.getByRole("textbox", { name: "EMAIL" });
    await input.waitFor();
    await input.fill(email);
    release();
    await page.waitForLoadState("networkidle");

    await expect(input).toHaveValue(email);
    await page.getByRole("button", { name: "寄連結給我" }).click();
    await expect(page.getByRole("status").filter({ hasText: "去信箱點一下就好" })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("新版登入信連結（token_hash，指向本站）：別的瀏覽器打開也能登入；壞連結回登入頁", async ({ browser, accounts }) => {
    const email = accounts.newEmail("authlink");
    const tokenHash = await generateMagicLinkTokenHash(email);
    const open = async (query: string) => {
      // 每次全新的 context＝信箱 app 內建瀏覽器：沒有寄信時的 PKCE cookie、也沒登入
      const context = await browser.newContext({ baseURL: BASE_URL, locale: "zh-TW" });
      const page = await context.newPage();
      await page.goto(`/auth/callback?next=%2Fme&${query}`);
      return { context, page };
    };

    const first = await open(`token_hash=${tokenHash}&type=email`);
    await expect(first.page).toHaveURL(/\/onboarding\/pen-name\?next=%2Fme/);
    await first.context.close();

    // 只能用一次；不在白名單的 type 不收
    for (const query of [`token_hash=${tokenHash}&type=email`, `token_hash=${tokenHash}&type=recovery`]) {
      const again = await open(query);
      await expect(again.page).toHaveURL(/\/login\?next=%2Fme&error=link/);
      await again.context.close();
    }
  });
});
