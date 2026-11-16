/**
 * 哪些文章算詞向量（純函式）：與 public-authors 同一條規則——
 * 公開＋筆名署名＋已發佈＋有分享網址＋不是 RSS 原始集數。私人日誌、匿名、不公開、未發佈一律不算。
 * DB 端 migration 031 的 episode_embedding_eligible() 是同一條規則的另一份，改這裡要一起改。
 */

import { PUBLIC_PEN_NAME_FILTER } from "@/lib/resonance/public-authors";

export interface EmbeddableFields {
  visibility: string | null;
  byline: string | null;
  published_at: string | null;
  share_slug: string | null;
  source: string | null;
}

export function isEmbeddable(episode: EmbeddableFields): boolean {
  return (
    episode.visibility === PUBLIC_PEN_NAME_FILTER.visibility &&
    episode.byline === PUBLIC_PEN_NAME_FILTER.byline &&
    episode.published_at !== null &&
    episode.share_slug !== null &&
    episode.source !== "rss"
  );
}
