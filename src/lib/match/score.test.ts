import { describe, expect, it } from "vitest";
import {
  jaccard,
  overlapScore,
  pickMatches,
  similarityScore,
  weekKey,
  MATCH_LIMIT,
  SIMILARITY_FLOOR,
  SIMILARITY_THRESHOLD,
  type MatchCandidate,
  type MatchSelf,
} from "./score";

const self: MatchSelf = {
  works: ["a", "b", "c", "d"],
  passages: ["e1:aaaa", "e2:bbbb"],
  showWeeks: ["a@2026-10-12"],
};

function candidate(overrides: Partial<MatchCandidate>): MatchCandidate {
  return { userId: "u", penName: "某人", works: [], passages: [], showWeeks: [], ...overrides };
}

describe("jaccard", () => {
  it("交集／聯集；兩邊都空是 0", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(jaccard([], [])).toBe(0);
  });
});

describe("weekKey：台北週一", () => {
  it("週日深夜仍屬同一週，週一起換週", () => {
    expect(weekKey(new Date("2026-10-18T15:00:00Z"))).toBe("2026-10-12"); // 台北 10/18（日）23:00
    expect(weekKey(new Date("2026-10-18T16:30:00Z"))).toBe("2026-10-19"); // 台北 10/19（一）00:30
  });
});

describe("overlapScore", () => {
  it("Jaccard×1 ＋ 共同畫記句×2 ＋ 同週同場×1", () => {
    const result = overlapScore(
      self,
      candidate({ works: ["a", "b", "x"], passages: ["e1:aaaa"], showWeeks: ["a@2026-10-12", "b@2026-10-05"] }),
    );
    expect(result.commonWorks).toEqual(["a", "b"]);
    expect(result.sharedPassages).toBe(1);
    expect(result.sameWeekShows).toBe(1);
    expect(result.score).toBeCloseTo(2 / 5 + 2 + 1);
  });
});

describe("pickMatches", () => {
  it("沒有共同作品的人不算；依分數排、取前 3", () => {
    const candidates = [
      candidate({ userId: "none", penName: "甲", works: ["z"], passages: ["e1:aaaa"] }),
      candidate({ userId: "one", penName: "乙", works: ["a"] }),
      candidate({ userId: "two", penName: "丙", works: ["a", "b"] }),
      candidate({ userId: "marks", penName: "丁", works: ["c"], passages: ["e2:bbbb"] }),
      candidate({ userId: "three", penName: "戊", works: ["a", "b", "c"] }),
    ];
    const picked = pickMatches(self, candidates);
    expect(picked).toHaveLength(MATCH_LIMIT);
    expect(picked.map((match) => match.userId)).toEqual(["marks", "three", "two"]);
    expect(picked[1].commonWorks).toEqual(["a", "b", "c"]);
  });

  it("排除自己", () => {
    expect(pickMatches(self, [candidate({ userId: "me", works: ["a"] })], { excludeUserId: "me" })).toEqual([]);
  });

  it("同分時共同作品多的在前，再依筆名", () => {
    const picked = pickMatches({ works: ["a", "b"], passages: [], showWeeks: [] }, [
      candidate({ userId: "y", penName: "乙", works: ["a"] }),
      candidate({ userId: "x", penName: "甲", works: ["b"] }),
    ]);
    expect(picked.map((match) => match.penName)).toEqual(["乙", "甲"].sort((a, b) => a.localeCompare(b, "zh-Hant")));
  });
});

describe("similarityScore：cosine 映射到 0–1", () => {
  it("SIMILARITY_FLOOR 以下是 0、1 是 1、中間線性", () => {
    expect(similarityScore(SIMILARITY_FLOOR - 0.2)).toBe(0);
    expect(similarityScore(-1)).toBe(0);
    expect(similarityScore(1)).toBe(1);
    expect(similarityScore((SIMILARITY_FLOOR + 1) / 2)).toBeCloseTo(0.5);
  });

  it("沒有相似度（沒有 embedding）是 0", () => {
    expect(similarityScore(undefined)).toBe(0);
  });
});

describe("overlapScore＋向量相似分", () => {
  it("分數＝共同作品分＋畫記＋同週同場＋相似分", () => {
    const withSimilarity = overlapScore(self, candidate({ works: ["a"], similarity: 1, similarTitle: "那晚" }));
    const without = overlapScore(self, candidate({ works: ["a"] }));
    expect(withSimilarity.score - without.score).toBeCloseTo(1);
    expect(withSimilarity.similarity).toBe(1);
    expect(withSimilarity.similarTitle).toBe("那晚");
    expect(without.similarity).toBe(0);
    expect(without.similarTitle).toBeNull();
  });
});

describe("pickMatches：候選＝共同作品 ≥1 或 向量相似 ≥ 門檻", () => {
  it("沒有共同作品但寫的東西很像 → 配到；不夠像 → 不配", () => {
    const picked = pickMatches(self, [
      candidate({ userId: "alike", penName: "甲", works: ["z"], similarity: SIMILARITY_THRESHOLD, similarTitle: "散場" }),
      candidate({ userId: "meh", penName: "乙", works: ["z"], similarity: SIMILARITY_THRESHOLD - 0.01 }),
    ]);
    expect(picked.map((match) => match.userId)).toEqual(["alike"]);
    expect(picked[0].commonWorks).toEqual([]);
  });

  it("相似分會影響排序：同樣共同作品，比較像的在前", () => {
    const picked = pickMatches({ works: ["a"], passages: [], showWeeks: [] }, [
      candidate({ userId: "plain", penName: "甲", works: ["a"] }),
      candidate({ userId: "alike", penName: "乙", works: ["a"], similarity: 0.9 }),
    ]);
    expect(picked.map((match) => match.userId)).toEqual(["alike", "plain"]);
  });

  it("自己沒有 embedding（候選都沒有 similarity）→ 行為同只看共同作品", () => {
    const picked = pickMatches(self, [candidate({ userId: "none", works: ["z"] })]);
    expect(picked).toEqual([]);
  });
});
