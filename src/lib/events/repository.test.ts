import { describe, expect, it } from "vitest";
import { chunkKeysByLength } from "./repository";

describe("chunkKeysByLength：norm_key 查詢依網址長度分批", () => {
  it("每批編碼後不超過上限、順序不變、一個都不漏", () => {
    const keys = Array.from({ length: 300 }, (_, index) => `散場測試演出第${index}場|2026-10-20|國家音樂廳`);
    const batches = chunkKeysByLength(keys, 4_000);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(keys);
    for (const batch of batches) {
      expect(batch.reduce((sum, key) => sum + encodeURIComponent(`"${key}",`).length, 0)).toBeLessThanOrEqual(4_000);
    }
  });

  it("單一超長的自成一批；空的回空", () => {
    expect(chunkKeysByLength(["長".repeat(2_000), "短"], 4_000)).toEqual([["長".repeat(2_000)], ["短"]]);
    expect(chunkKeysByLength([])).toEqual([]);
  });
});
