/** 我的 · 專欄作者頁：作者常數與統計推導 */

import { categoryFromSource, CATEGORY_LABELS } from "@/lib/feed/entries";
import { formatIssueMonth } from "@/lib/share/article";

/**
 * 單人產品暫無帳號系統：作者卡先用常數。
 * TODO: 之後改讀 settings（author_profile key）或使用者資料。
 */
export const AUTHOR = {
  penName: "作者",
  initial: "作",
  bio: "散場之後把想說的話說完，交給 AI 整理成一篇。偏愛那些沒發生什麼大事的作品。",
} as const;

export interface AuthorEpisodeRow {
  source: string;
  created_at: string;
  hasBlog: boolean;
}

export interface AuthorStats {
  sinceMonth: string | null;
  publishedCount: number;
  draftCount: number;
  mostWritten: string;
}

export function buildAuthorStats(rows: AuthorEpisodeRow[]): AuthorStats {
  const published = rows.filter((row) => row.hasBlog);
  const counts: Record<string, number> = {};
  for (const row of published) {
    const label = CATEGORY_LABELS[categoryFromSource(row.source)];
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const mostWritten =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const earliest = published
    .map((row) => row.created_at)
    .sort((a, b) => a.localeCompare(b))[0];

  return {
    sinceMonth: earliest ? formatIssueMonth(earliest) : null,
    publishedCount: published.length,
    draftCount: rows.length - published.length,
    mostWritten,
  };
}
