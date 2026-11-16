import { describe, expect, it } from "vitest";
import { columnCount, columnGroups } from "./column-groups";

const sums = (groups: number[][], heights: readonly number[]) =>
  groups.map((group) => group.reduce((sum, index) => sum + heights[index], 0));

describe("columnGroups", () => {
  it("放得下就一組", () => {
    expect(columnGroups([100, 200, 300], 600)).toEqual([[0, 1, 2]]);
  });

  it("沒有段落回空陣列", () => {
    expect(columnGroups([], 600)).toEqual([]);
  });

  it("容量不合理（0、負數）當一組，不切", () => {
    expect(columnGroups([100, 100], 0)).toEqual([[0, 1]]);
    expect(columnGroups([100, 100], -5)).toEqual([[0, 1]]);
  });

  it("超過容量：切成最少組數，每組不超過容量，盡量平均（最後一組不會只剩一點）", () => {
    const heights = Array.from({ length: 10 }, () => 100);
    const groups = columnGroups(heights, 400);
    expect(groups).toHaveLength(3);
    expect(groups.flat()).toEqual(heights.map((_, index) => index));
    expect(Math.max(...sums(groups, heights))).toBeLessThanOrEqual(400);
    expect(Math.min(...sums(groups, heights))).toBeGreaterThanOrEqual(300);
  });

  it("小標不留在一組的最後（往下一組帶）", () => {
    // 不管小標，最接近平均的切點在第 2 段（小標）後面
    const heights = [380, 40, 200, 200];
    expect(columnGroups(heights, 450)).toEqual([[0, 1], [2, 3]]);
    const keepWithNext = [false, true, false, false];
    expect(columnGroups(heights, 450, keepWithNext)).toEqual([[0], [1, 2, 3]]);
  });

  it("單一段落就超過容量：自己一組，其他照常", () => {
    const groups = columnGroups([100, 900, 100], 400);
    expect(groups).toEqual([[0], [1], [2]]);
  });

  it("組內順序不變、每段只出現一次", () => {
    const heights = [120, 340, 80, 260, 90, 410, 30, 220];
    const groups = columnGroups(heights, 500);
    expect(groups.flat()).toEqual(heights.map((_, index) => index));
    sums(groups, heights).forEach((sum, index) => {
      const single = groups[index].length === 1;
      if (!single) expect(sum).toBeLessThanOrEqual(500);
    });
  });
});

describe("columnCount", () => {
  it("照 column-width 與間距算實際欄數（同瀏覽器 multicol 規則）", () => {
    expect(columnCount(340, 340, 48)).toBe(1);
    expect(columnCount(727, 340, 48)).toBe(1);
    expect(columnCount(728, 340, 48)).toBe(2);
    expect(columnCount(1116, 340, 48)).toBe(3);
  });

  it("寬度比一欄還窄也至少一欄", () => {
    expect(columnCount(200, 340, 48)).toBe(1);
    expect(columnCount(0, 340, 48)).toBe(1);
  });
});
