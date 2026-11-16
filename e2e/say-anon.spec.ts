/** 先說後登入：匿名說一段（打字／錄音）→ 導去登入 → 回到 /say?resume=1 還原 → 送出 */

import { rest } from "./fixtures/admin";
import { completePenName, submitLoginAndFollowLink, waitForHydration } from "./fixtures/auth";
import { expect, holdToRecord, readSayDraft, test, useFakeMicrophone, type Accounts } from "./fixtures/test";
import { seedTestWork, type SeededWork } from "./fixtures/works-seed";

const RESUME_LOGIN_URL = /\/login\?next=%2Fsay%3Fresume%3D1$/;
const GENERATE_TIMEOUT_MS = 90_000;
const TRANSCRIBE_TIMEOUT_MS = 120_000;

interface EpisodeRow {
  id: string;
  user_id: string;
  status: string;
  audio_url: string | null;
  work_id: string | null;
}

async function findMovieWork(accounts: Accounts): Promise<SeededWork> {
  return seedTestWork(accounts, "say-anon");
}

function episodeIdFrom(url: string): string {
  const match = url.match(/\/(?:proof|episodes)\/([0-9a-f-]{36})/);
  if (!match) throw new Error(`[e2e] 網址裡沒有 episode id：${url}`);
  return match[1];
}

test.describe("說一段：先說後登入", () => {
  test("打字 → 登入 → 文字與作品卡還在 → 送出到校樣，草稿清除", async ({ page, accounts }) => {
    const work = await findMovieWork(accounts);
    // 只有一句時模型常回【無法生成】（UX-02 會擋下、草稿保留），這裡要測的是整理成功後清草稿：給足夠的原話
    const text = `E2E 測試：散場之後燈亮起來，我還坐著看完字幕。這部片最讓我留下來的是那段沒有配樂的長鏡頭，兩個人在車站等車，什麼都沒說，卻比任何對白都重。看完我想到自己第一次離家的那個晚上，也是這樣安靜。我覺得導演很懂得留白，讓觀眾自己把情緒填進去。${Date.now()}`;
    const cardTitle = `剛看完《${work.title}》`;

    await page.goto(`/say?work=${work.slug}`);
    await waitForHydration(page, 'button[aria-label="按住說話"]');
    await page.getByRole("button", { name: "用打的" }).click();
    await expect(page.getByText(cardTitle)).toBeVisible();
    await page.locator("#say-text").fill(text);
    await page.getByRole("button", { name: "登入後整理成一篇" }).click();

    await expect(page).toHaveURL(RESUME_LOGIN_URL);
    expect(await readSayDraft(page)).toMatchObject({ kind: "text", text });

    const email = accounts.newEmail("say-text");
    await submitLoginAndFollowLink(page, email);
    await completePenName(page);

    await expect(page).toHaveURL(/\/say\?resume=1$/);
    await expect(page.getByRole("status")).toContainText("剛剛寫的還在");
    await expect(page.locator("#say-text")).toHaveValue(text);
    await expect(page.getByText(cardTitle)).toBeVisible();

    await page.getByRole("button", { name: "幫我整理成一篇" }).click();
    await page.waitForURL(/\/proof\/[0-9a-f-]{36}$/, { timeout: GENERATE_TIMEOUT_MS });

    const episodeId = episodeIdFrom(page.url());
    const userId = await accounts.userIdOf(email);
    const [episode] = await rest<EpisodeRow>("episodes", `select=id,user_id,status,audio_url,work_id&id=eq.${episodeId}`);
    expect(episode).toMatchObject({ user_id: userId, work_id: work.id });

    await expect.poll(() => readSayDraft(page)).toBeNull();
  });

  test("錄音 → 登入 → 提示錄音還在 → 送出這段", async ({ page, context, accounts }) => {
    await useFakeMicrophone(context);
    await page.goto("/say");
    await waitForHydration(page, 'button[aria-label="按住說話"]');
    await holdToRecord(page, 3_500);

    await expect(page).toHaveURL(RESUME_LOGIN_URL);
    const stashed = await readSayDraft(page);
    expect(stashed?.kind).toBe("voice");
    expect(stashed?.seconds).toBeGreaterThanOrEqual(3);

    const email = accounts.newEmail("say-voice");
    await submitLoginAndFollowLink(page, email);
    await completePenName(page);

    await expect(page).toHaveURL(/\/say\?resume=1$/);
    await expect(page.getByRole("status")).toContainText(/剛剛說的 0:0\d 還在/);

    await page.getByRole("button", { name: "送出這段" }).click();
    await expect(page.getByRole("heading", { name: "正在幫你整理…" })).toBeVisible();

    // 上傳成功 → episode 建立且屬於這位使用者（不論轉錄結果）
    const userId = await accounts.userIdOf(email);
    await expect
      .poll(async () => (await rest<EpisodeRow>("episodes", `select=id&user_id=eq.${userId}`)).length, {
        timeout: 30_000,
      })
      .toBe(1);
    const [created] = await rest<EpisodeRow>("episodes", `select=id,user_id,status,audio_url,work_id&user_id=eq.${userId}`);
    expect(created.audio_url).toContain(`/audio/episodes/${userId}/`);

    // 轉錄（Groq）完成 → 校樣；轉錄失敗 → 集數頁。
    // 假麥克風是正弦波、沒有人聲：轉錄常只出「.」→ 不送整理、刪掉這段、留在說一段給「改用打的」（UX-02）
    const notHeard = page.locator("p[role=alert]").filter({ hasText: "沒聽清楚，再說一次，或改用打的。" });
    await expect
      .poll(async () => ((await notHeard.isVisible()) ? "not-heard" : /\/(proof|episodes)\/[0-9a-f-]{36}$/.test(page.url()) ? "landed" : null), {
        timeout: TRANSCRIBE_TIMEOUT_MS,
        intervals: [1_000],
      })
      .not.toBeNull();
    test.info().annotations.push({ type: "voice-submit-result", description: `url=${new URL(page.url()).pathname}` });

    if (await notHeard.isVisible()) {
      await expect(page).toHaveURL(/\/say\?resume=1$/);
      await expect(notHeard.getByRole("button", { name: "改用打的" })).toBeVisible();
      await expect.poll(async () => (await rest("episodes", `select=id&id=eq.${created.id}`)).length).toBe(0);
    } else {
      expect(episodeIdFrom(page.url())).toBe(created.id);
      const [finalRow] = await rest<EpisodeRow>("episodes", `select=id,user_id,status,audio_url,work_id&id=eq.${created.id}`);
      expect(page.url()).toContain(`/proof/${created.id}`);
      expect(finalRow.status).toBe("transcribed");
    }
    await expect.poll(() => readSayDraft(page)).toBeNull();
  });
});
