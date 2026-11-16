import { CATEGORY_TAB_LABELS, FEED_CATEGORIES, feedTabHref, type FeedCategory } from "./categories";
import type { FeedEntry } from "./entries";

/** 桌機目錄右欄「索引」：欄目計數＋這週被說起的作品（資料只取目錄本身，不另查） */

export interface IndexColumnRow {
  key: FeedCategory;
  label: string;
  count: number;
  href: string;
}

export interface IndexWorkRow {
  title: string;
  category: FeedCategory;
  count: number;
  /** 縮圖：該作品第一筆有海報的條目 */
  posterUrl: string | null;
}

const MAX_WORKS = 3;

/** maxWorks：作品幾部（右欄三部；寬版海報架一列可以多放） */
export function feedIndex(entries: readonly FeedEntry[], maxWorks: number = MAX_WORKS): { columns: IndexColumnRow[]; works: IndexWorkRow[] } {
  const columns = FEED_CATEGORIES.map((key) => ({
    key,
    label: CATEGORY_TAB_LABELS[key],
    count: entries.filter((entry) => entry.category === key).length,
    href: feedTabHref(key),
  })).filter((row) => row.count > 0);

  const tally = new Map<string, IndexWorkRow>();
  for (const entry of entries) {
    if (!entry.workTitle) continue;
    const current = tally.get(entry.workTitle);
    tally.set(entry.workTitle, {
      title: entry.workTitle,
      category: current?.category ?? entry.category,
      count: (current?.count ?? 0) + 1,
      posterUrl: current?.posterUrl ?? entry.posterUrl,
    });
  }
  // Map 保留第一次出現的順序；sort 穩定，同數維持原順序
  const works = [...tally.values()].sort((a, b) => b.count - a.count).slice(0, maxWorks);

  return { columns, works };
}
