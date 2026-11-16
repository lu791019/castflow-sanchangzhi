import { describe, expect, it } from "vitest";
import { workJsonLd } from "@/lib/seo/work";
import { latestRatingPerUser, ratingSummaryLabel, summarizeRatings } from "./rating-summary";

describe("summarizeRatings", () => {
  it("少於 3 人只給人數（不洩漏個人星等）", () => {
    expect(summarizeRatings([4.5, 3])).toEqual({ count: 2, average: null });
    expect(ratingSummaryLabel({ count: 2, average: null })).toBe("散場誌 2 人評過");
  });

  it("3 人以上平均四捨五入到 0.1", () => {
    expect(summarizeRatings([4.5, 4, 3.5])).toEqual({ count: 3, average: 4 });
    expect(summarizeRatings([5, 4.5, 4.5, 3])).toEqual({ count: 4, average: 4.3 });
    expect(ratingSummaryLabel({ count: 3, average: 4 })).toBe("散場誌 3 人評過・平均 ★ 4.0");
  });

  it("沒人評過不顯示；異常值不算", () => {
    expect(ratingSummaryLabel(summarizeRatings([]))).toBeNull();
    expect(summarizeRatings([Number.NaN, 0, 6, 4]).count).toBe(1);
  });
});

describe("latestRatingPerUser", () => {
  it("同一人記好幾筆只算最新一筆（不能自己灌筆數湊到 3）", () => {
    const rows = [
      { user_id: "a", rating: "5", created_at: "2026-10-01T00:00:00Z" },
      { user_id: "a", rating: 5, created_at: "2026-10-02T00:00:00Z" },
      { user_id: "a", rating: 3, created_at: "2026-10-03T00:00:00Z" },
      { user_id: "b", rating: "4.5", created_at: "2026-10-01T00:00:00Z" },
    ];
    expect(latestRatingPerUser(rows).sort()).toEqual([3, 4.5]);
    expect(summarizeRatings(latestRatingPerUser(rows))).toEqual({ count: 2, average: null });
  });
});

describe("workJsonLd", () => {
  const base = { kind: "movie" as const, title: "海街日記", url: "https://x/works/a", image: null, year: 2015 };

  it("人數不足不帶 aggregateRating", () => {
    expect(workJsonLd({ ...base, rating: { count: 2, average: null } })).not.toHaveProperty("aggregateRating");
  });

  it("≥3 人帶 AggregateRating（0.5～5）", () => {
    expect(workJsonLd({ ...base, rating: { count: 3, average: 4 } })).toMatchObject({
      "@type": "Movie",
      name: "海街日記",
      dateCreated: "2015",
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4, ratingCount: 3, bestRating: 5, worstRating: 0.5 },
    });
  });
});
