/**
 * 作品頁的星等彙總（Q-83）：匿名，只有人數與平均；少於 3 人不顯示平均（一兩個人的分數等於公開個人星等）。
 */

export const MIN_RATINGS_FOR_AVERAGE = 3;

export interface RatingSummary {
  count: number;
  /** 四捨五入到 0.1；人數不足為 null */
  average: number | null;
}

export interface RatingRow {
  user_id: string;
  rating: number | string;
  created_at: string;
}

/**
 * 每人只算最新一筆：門檻與平均都以「人」計，不以筆數計——
 * 否則一個人對同一部記好幾筆，就能把「1 人評過」湊到 3 筆、從平均反推別人的星等。
 */
export function latestRatingPerUser(rows: readonly RatingRow[]): number[] {
  const latest = new Map<string, RatingRow>();
  for (const row of rows) {
    const seen = latest.get(row.user_id);
    if (!seen || row.created_at > seen.created_at) latest.set(row.user_id, row);
  }
  return [...latest.values()].map((row) => Number(row.rating));
}

export function summarizeRatings(ratings: readonly number[]): RatingSummary {
  const valid = ratings.filter((rating) => Number.isFinite(rating) && rating >= 0.5 && rating <= 5);
  if (valid.length < MIN_RATINGS_FOR_AVERAGE) return { count: valid.length, average: null };
  const sum = valid.reduce((total, rating) => total + rating, 0);
  return { count: valid.length, average: Math.round((sum / valid.length) * 10) / 10 };
}

export function ratingSummaryLabel(summary: RatingSummary): string | null {
  if (summary.count === 0) return null;
  if (summary.average === null) return `散場誌 ${summary.count} 人評過`;
  return `散場誌 ${summary.count} 人評過・平均 ★ ${summary.average.toFixed(1)}`;
}
