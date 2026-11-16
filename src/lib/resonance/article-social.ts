/**
 * 文章頁（/s/[slug]）共鳴與同場的資料（server only）：一次讀齊，分享頁只插一行。
 */

import { getCurrentUserId } from "@/lib/auth/session";
import type { ArticleBlock } from "@/lib/share/article";
import type { CastMember } from "./feature";
import type { PassageMark } from "./marks";
import { listPassages } from "./passage";
import { loadPassageMarks } from "./repository";
import { loadArticleSameShow } from "./same-show";

export interface ArticleSocial {
  signedIn: boolean;
  /** block 位置 → 段雜湊 */
  passageHashes: Record<number, string>;
  marks: Record<string, PassageMark>;
  sameShow: CastMember[];
}

/** 社群關閉時：沒有句邊標記、沒有同場 */
export const NO_ARTICLE_SOCIAL: ArticleSocial = { signedIn: false, passageHashes: {}, marks: {}, sameShow: [] };

interface ArticleSocialInput {
  episodeId: string;
  authorId: string;
  workId: string | null;
  blocks: ArticleBlock[];
  now?: Date;
}

export async function loadArticleSocial({
  episodeId,
  authorId,
  workId,
  blocks,
  now = new Date(),
}: ArticleSocialInput): Promise<ArticleSocial> {
  const passages = listPassages(blocks);
  const viewerId = await getCurrentUserId();
  const [marks, sameShow] = await Promise.all([
    loadPassageMarks(episodeId, passages, viewerId),
    workId ? loadArticleSameShow(workId, authorId, now) : Promise.resolve([]),
  ]);
  return {
    signedIn: viewerId !== null,
    passageHashes: Object.fromEntries(passages.map((passage) => [passage.blockIndex, passage.hash])),
    marks,
    sameShow,
  };
}
