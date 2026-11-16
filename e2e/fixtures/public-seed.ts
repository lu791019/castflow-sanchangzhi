/**
 * 公開頁 E2E 的前置資料：自己種一位作者（公開文章＋RSS 單集）與一部電影，不依賴 DB 既有資料
 * （雲端有真資料，但不能假設它存在、也不該拿它來測）。帳號走 accounts.newEmail、作品走 accounts.trackWork，結束後清。
 */

import { rest } from "./admin";
import { seedPublished, seedWork } from "./og-seed";
import { seedRssEpisode } from "./p2-seed";
import { createAuthor } from "./p3idx-seed";
import type { Accounts } from "./test";

export interface PublicFixtures {
  shareSlug: string;
  workSlug: string;
  rssEpisodeId: string;
}

export async function seedPublicFixtures(accounts: Accounts, tag: string): Promise<PublicFixtures> {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const authorId = await createAuthor(accounts.newEmail(`${tag}-author`), `公開${stamp}`.slice(0, 20));
  const workId = await seedWork({ kind: "movie", title: `公開頁測試電影 ${stamp}` });
  accounts.trackWork(workId);
  const [work] = await rest<{ slug: string }>("works", `select=slug&id=eq.${workId}`);
  const shareSlug = await seedPublished(authorId, {
    workId,
    title: `公開頁測試文章 ${stamp}`,
    lede: "散場之後走回車站的路上。",
    pullQuote: "燈亮了，我還坐著。",
    saidAt: new Date().toISOString(),
  });
  const rssEpisodeId = await seedRssEpisode(authorId, `公開頁測試節目 ${stamp}`);
  return { shareSlug, workSlug: work.slug, rssEpisodeId };
}
