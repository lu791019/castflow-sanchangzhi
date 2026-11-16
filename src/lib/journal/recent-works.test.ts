import { describe, expect, it } from "vitest";
import { mergeRecentWorkIds } from "./recent-works";

describe("mergeRecentWorkIds", () => {
  it("兩個來源依時間合併、去重、取前 n", () => {
    const journal = [
      { workId: "a", at: "2026-10-09T10:00:00Z" },
      { workId: "b", at: "2026-10-07T10:00:00Z" },
    ];
    const episodes = [
      { workId: "c", at: "2026-10-08T10:00:00Z" },
      { workId: "a", at: "2026-10-01T10:00:00Z" },
    ];
    expect(mergeRecentWorkIds([journal, episodes])).toEqual(["a", "c", "b"]);
    expect(mergeRecentWorkIds([journal, episodes], 2)).toEqual(["a", "c"]);
  });
});
