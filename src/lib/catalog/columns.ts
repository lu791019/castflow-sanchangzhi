/**
 * 索引 › 欄目：五個固定欄目與歸屬規則（設計稿「P3 索引 C 欄目」只定義欄目，沒定義歸屬，這裡先提一版）。
 *
 * 歸屬只看作品類型與「是不是重看」，優先序：
 * 1. 綁的作品是演出／展覽（live、performance、exhibition）→ 現場
 * 2. 綁的作品是 Podcast 單集 → 一集一句（重聽不算重看）
 * 3. 同一位作者對同一部電影／影集，較早已有一篇公開文章 → 重看
 * 4. 綁的作品是影集 → 影集通勤
 * 5. 其餘（電影、沒綁作品）→ 散場之後・隨筆
 * 只用公開資料判斷（較早的那篇也必須是公開的），不會因為私人文章洩漏「看過」。
 */

export type ColumnKey = "essay" | "commute" | "one_line" | "onsite" | "rewatch";

export interface CatalogColumn {
  key: ColumnKey;
  name: string;
  /** 封面上的直排小字 */
  tagline: string;
  description: string;
}

export const CATALOG_COLUMNS: ReadonlyArray<CatalogColumn> = [
  { key: "essay", name: "散場之後・隨筆", tagline: "隨筆・每晚更新", description: "看完一部電影，說一段，整理成一篇隨筆。這本刊物最早的欄目。" },
  { key: "commute", name: "影集通勤", tagline: "一站一集", description: "在路上追的劇，一站一集，下車前說完。" },
  { key: "one_line", name: "一集一句", tagline: "一集一句", description: "聽完一集 podcast，只留下一句。" },
  { key: "onsite", name: "現場", tagline: "演出・展覽", description: "音樂祭、演出、展覽。散場的地方不在螢幕前。" },
  { key: "rewatch", name: "重看", tagline: "第二次", description: "第二次看，才看見的事。" },
];

const ONSITE_KINDS = new Set(["live", "performance", "exhibition"]);
const SCREEN_KINDS = new Set(["movie", "series"]);

export function columnName(key: ColumnKey): string {
  return CATALOG_COLUMNS.find((column) => column.key === key)?.name ?? "";
}

export function parseColumnKey(value: string | undefined): ColumnKey | null {
  return CATALOG_COLUMNS.find((column) => column.key === value)?.key ?? null;
}

export function columnOf({ workKind, isRewatch }: { workKind: string | null; isRewatch: boolean }): ColumnKey {
  if (workKind && ONSITE_KINDS.has(workKind)) return "onsite";
  if (workKind === "podcast_episode") return "one_line";
  if (isRewatch && workKind && SCREEN_KINDS.has(workKind)) return "rewatch";
  if (workKind === "series") return "commute";
  return "essay";
}

export interface ColumnInput {
  id: string;
  userId: string;
  workId: string | null;
  workKind: string | null;
  publishedAt: string;
}

/** 一批公開文章 → 文章 id 對欄目；重看＝同作者同作品較早已有一篇 */
export function assignColumns(articles: ReadonlyArray<ColumnInput>): Map<string, ColumnKey> {
  const sorted = [...articles].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const seen = new Set<string>();
  const result = new Map<string, ColumnKey>();
  for (const article of sorted) {
    const pairKey = article.workId ? `${article.userId}:${article.workId}` : null;
    const isRewatch = pairKey !== null && seen.has(pairKey);
    if (pairKey) seen.add(pairKey);
    result.set(article.id, columnOf({ workKind: article.workKind, isRewatch }));
  }
  return result;
}
