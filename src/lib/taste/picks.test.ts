import { describe, expect, it } from "vitest";
import { MAX_STORED_PICKS, mergeTastePicks, parseStoredPicks, tastePicksKey } from "./picks";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("tastePicksKey（每人一列，存在既有 settings 表，同提醒設定的寫法）", () => {
  it("帶 userId", () => {
    expect(tastePicksKey("u1")).toBe("taste_picks:u1");
  });
});

describe("parseStoredPicks（讀回來的 jsonb 不可信）", () => {
  it("合法列保留，壞列丟掉", () => {
    expect(
      parseStoredPicks({
        picks: [
          { workId: A, seen: true, at: "2026-10-14T00:00:00.000Z" },
          { workId: "x", seen: true, at: "2026-10-14T00:00:00.000Z" },
          { workId: B, seen: "yes", at: "2026-10-14T00:00:00.000Z" },
          { workId: C, seen: false },
        ],
      }),
    ).toEqual([{ workId: A, seen: true, at: "2026-10-14T00:00:00.000Z" }]);
  });

  it("不是物件或沒有 picks → 空", () => {
    expect(parseStoredPicks(null)).toEqual([]);
    expect(parseStoredPicks({ picks: "nope" })).toEqual([]);
  });
});

describe("mergeTastePicks（新挑的放前面、同一部以新的為準、有上限）", () => {
  const now = new Date("2026-10-14T12:00:00.000Z");
  const old = [{ workId: A, seen: false, at: "2026-10-01T00:00:00.000Z" }];

  it("同一部改成看過，時間更新", () => {
    expect(mergeTastePicks(old, [{ workId: A, seen: true }, { workId: B, seen: false }], now)).toEqual([
      { workId: A, seen: true, at: now.toISOString() },
      { workId: B, seen: false, at: now.toISOString() },
    ]);
  });

  it("不改原陣列", () => {
    const frozen = Object.freeze([...old]);
    mergeTastePicks(frozen, [{ workId: B, seen: true }], now);
    expect(frozen).toEqual(old);
  });

  it(`最多留 ${MAX_STORED_PICKS} 部`, () => {
    const many = Array.from({ length: MAX_STORED_PICKS }, (_, index) => ({
      workId: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
      seen: true,
      at: "2026-10-01T00:00:00.000Z",
    }));
    const merged = mergeTastePicks(many, [{ workId: C, seen: true }], now);
    expect(merged).toHaveLength(MAX_STORED_PICKS);
    expect(merged[0].workId).toBe(C);
  });
});
