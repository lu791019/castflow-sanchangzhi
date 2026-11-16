/** 索引 › 作者：依最近一篇排序（Token「order.noRank」），只收以筆名署名的公開文章 */

import { dotDate } from "./numbers";

export interface AuthorRow {
  penName: string;
  count: number;
  latestAt: string;
  /** 作者自己取的專欄名；沒取是 null，畫面就不顯示 */
  columnName: string | null;
  /** 「12 篇・最近一篇 10.08」 */
  meta: string;
}

export function authorMeta(count: number, latestAt: string): string {
  return `${count} 篇・最近一篇 ${dotDate(latestAt)}`;
}

export function buildAuthorRows(
  articles: ReadonlyArray<{ penName: string; publishedAt: string }>,
  columnNames: ReadonlyMap<string, string> = new Map(),
): AuthorRow[] {
  const grouped = new Map<string, { count: number; latestAt: string }>();
  for (const { penName, publishedAt } of articles) {
    const prev = grouped.get(penName);
    grouped.set(penName, {
      count: (prev?.count ?? 0) + 1,
      latestAt: prev && prev.latestAt > publishedAt ? prev.latestAt : publishedAt,
    });
  }
  return [...grouped.entries()]
    .map(([penName, { count, latestAt }]) => ({
      penName,
      count,
      latestAt,
      columnName: columnNames.get(penName) ?? null,
      meta: authorMeta(count, latestAt),
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}
