/**
 * 詞向量配對（Q-48）：
 * - 沒有 VOYAGE_API_KEY：散場之前的配對照常顯示（只有共同作品的同好），不會出現「寫的東西很像」，也不寫 episode_embeddings
 * - /api/episodes/embeddings/refresh：要 x-api-key；用 service role 種兩篇公開筆名文章，回 200 且 scanned 數正確（沒 key 全數 skipped）
 * - 向量相似（不經 Voyage，直接種向量）：沒有共同作品但寫得像的公開作者會配到，帶對方那篇標題；改成不公開時 trigger 刪列
 * 只跑本 spec：E2E_EMAIL_PREFIX=e2e+embed- E2E_PORT=3062 npx playwright test e2e/embed.spec.ts --global-setup=…（見交件說明）
 */

import { rest } from "./fixtures/admin";
import { loginAsNewUser } from "./fixtures/auth";
import { BASE_URL, serviceRoleKey, supabaseUrl } from "./fixtures/env";
import { patch } from "./fixtures/p2-seed";
import { seedArticle, seedUser, seedWorkRow } from "./fixtures/p3res-seed";
import { expect, test } from "./fixtures/test";

const DAY = 24 * 60 * 60 * 1000;
const BEFORE_TIMEOUT_MS = 45_000;
const REFRESH_LIMIT = 10;
const DIM = 1024;
const PARAGRAPHS = ["那天走出戲院，海風很大，我想起小時候的夏天，一直走到車站才回過神來。", "第二段。"];

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceRoleKey();
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function insertJournal(userId: string, workId: string): Promise<void> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/journal_entries`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ user_id: userId, work_id: workId, experienced_at: new Date(Date.now() - DAY).toISOString(), venue: "cinema", status: "recorded" }),
  });
  if (!response.ok) throw new Error(`[embed seed] journal_entries → ${response.status}`);
}

/** 直接種向量（不打 Voyage）：one-hot，同一個 axis 的兩篇 cosine＝1 */
async function insertEmbedding(episodeId: string, axis: number): Promise<void> {
  const vector = Array.from({ length: DIM }, (_, i) => (i === axis ? 1 : 0));
  const response = await fetch(`${supabaseUrl()}/rest/v1/episode_embeddings`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ episode_id: episodeId, model: "voyage-3", dim: DIM, embedding: `[${vector.join(",")}]`, content_hash: "e2e-seed" }),
  });
  if (!response.ok) throw new Error(`[embed seed] episode_embeddings → ${response.status} ${(await response.text()).slice(0, 200)}`);
}

async function embeddingsOf(episodeIds: readonly string[]): Promise<string[]> {
  const rows = await rest<{ episode_id: string }>("episode_embeddings", `select=episode_id&episode_id=in.(${episodeIds.join(",")})`);
  return rows.map((row) => row.episode_id);
}

/** 目前所有公開筆名文章中還沒有 embedding 的篇數（與 episode_embedding_eligible() 同規則） */
async function countMissingEmbeddings(): Promise<number> {
  const [eligible, embedded] = await Promise.all([
    rest<{ id: string }>(
      "episodes",
      "select=id&visibility=eq.public&byline=eq.pen_name&published_at=not.is.null&share_slug=not.is.null&source=neq.rss&limit=10000",
    ),
    rest<{ episode_id: string }>("episode_embeddings", "select=episode_id&limit=10000"),
  ]);
  const done = new Set(embedded.map((row) => row.episode_id));
  return eligible.filter((row) => !done.has(row.id)).length;
}

async function callRefresh(apiKey: string | null): Promise<Response> {
  return fetch(`${BASE_URL}/api/episodes/embeddings/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
    body: "{}",
  });
}

test("沒有 VOYAGE_API_KEY：散場之前照常只用共同作品配對", async ({ page, accounts }) => {
  test.skip(Boolean(process.env.VOYAGE_API_KEY), "本機設了 VOYAGE_API_KEY，降級路徑不適用");
  const email = accounts.newEmail("me");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);
  const shared = await seedWorkRow("海街日記");
  const other = await seedWorkRow("悲情城市");
  accounts.trackWork(shared.id);
  accounts.trackWork(other.id);
  await insertJournal(userId, shared.id);

  const friend = await seedUser(accounts.newEmail("friend"), "同好");
  const friendArticle = await seedArticle(friend.id, { workId: shared.id, title: "散場後想起海街", paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date(Date.now() - DAY) });
  const stranger = await seedUser(accounts.newEmail("stranger"), "路人");
  const strangerArticle = await seedArticle(stranger.id, { workId: other.id, title: "悲情城市之後", paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date(Date.now() - DAY) });

  await page.goto("/before");
  const matches = page.getByRole("region", { name: /有人跟你看了同樣 \d+ 部/ });
  await expect(matches).toBeVisible({ timeout: BEFORE_TIMEOUT_MS });
  const row = matches.getByRole("link").filter({ hasText: friend.penName });
  await expect(row).toContainText("同樣 1 部");
  await expect(row).toContainText("《海街日記》");
  await expect(matches).not.toContainText("你們寫的東西很像");
  await expect(matches.getByRole("link").filter({ hasText: stranger.penName })).toHaveCount(0);

  // 沒 key：補算也不會寫任何向量
  expect((await callRefresh(process.env.API_SECRET_KEY ?? "")).status).toBe(200);
  expect(await embeddingsOf([friendArticle.id, strangerArticle.id])).toEqual([]);
});

test("/api/episodes/embeddings/refresh：要 x-api-key；scanned 數正確，沒 key 全數 skipped", async ({ accounts }) => {
  test.skip(Boolean(process.env.VOYAGE_API_KEY), "本機設了 VOYAGE_API_KEY，會真的打 Voyage");
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) throw new Error("[embed e2e] 缺少 API_SECRET_KEY");
  expect((await callRefresh(null)).status).toBe(401);

  const author = await seedUser(accounts.newEmail("author"), "寫字");
  const work = await seedWorkRow("一一");
  accounts.trackWork(work.id);
  for (const title of ["第一篇", "第二篇"]) {
    await seedArticle(author.id, { workId: work.id, title, paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date() });
  }
  // 不算的：不公開、匿名
  await seedArticle(author.id, { workId: work.id, title: "私人", paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date(), visibility: "private" });
  await seedArticle(author.id, { workId: work.id, title: "匿名", paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date(), byline: "anonymous" });

  const missing = await countMissingEmbeddings();
  expect(missing).toBeGreaterThanOrEqual(2);
  const response = await callRefresh(apiKey);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: { scanned: number; embedded: number; skipped: number; failed: number } };
  const expected = Math.min(REFRESH_LIMIT, missing);
  expect(body.data).toMatchObject({ scanned: expected, embedded: 0, skipped: expected, failed: 0 });
});

test("寫得像就配到（不需共同作品），改成不公開時向量列被刪", async ({ page, accounts }) => {
  const email = accounts.newEmail("writer");
  await loginAsNewUser(page, email, "/before");
  const userId = await accounts.userIdOf(email);
  const mine = await seedWorkRow("戀戀風塵");
  const theirs = await seedWorkRow("童年往事");
  accounts.trackWork(mine.id);
  accounts.trackWork(theirs.id);
  const axis = Math.floor(Math.random() * DIM);

  const myArticle = await seedArticle(userId, { workId: mine.id, title: "我寫的那晚", paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date(Date.now() - DAY) });
  const twin = await seedUser(accounts.newEmail("twin"), "知音");
  const twinArticle = await seedArticle(twin.id, { workId: theirs.id, title: "她寫的那晚", paragraphs: PARAGRAPHS, pullQuote: "海風很大", saidAt: new Date(Date.now() - DAY) });
  await insertEmbedding(myArticle.id, axis);
  await insertEmbedding(twinArticle.id, axis);

  await page.goto("/before");
  // 打包版換頁串流會短暫留一份隱藏的副本：只看看得到的那份
  const matches = page.getByTestId("taste-matches").filter({ visible: true });
  await expect(matches).toBeVisible({ timeout: BEFORE_TIMEOUT_MS });
  const row = matches.getByRole("link").filter({ hasText: twin.penName });
  await expect(row).toContainText("你們寫的東西很像・〈她寫的那晚〉");
  await expect(row).not.toContainText("同樣");

  // 對方改成不公開 → trigger 刪列 → 不再配到
  await patch("episodes", `id=eq.${twinArticle.id}`, { visibility: "private" });
  expect(await embeddingsOf([twinArticle.id, myArticle.id])).toEqual([myArticle.id]);
  await page.reload();
  await expect(page.getByTestId("taste-matches").filter({ visible: true }).getByRole("link").filter({ hasText: twin.penName })).toHaveCount(0, { timeout: BEFORE_TIMEOUT_MS });
});
