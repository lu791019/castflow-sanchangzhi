import { describe, expect, it } from "vitest";
import { DISMISS_DISTANCE, dragOffset, dragRelease } from "./log-sheet-drag";

describe("dragOffset（sheet 跟手）", () => {
  it("往下拖：位移等於手指移動距離", () => {
    expect(dragOffset(100, 180)).toBe(80);
  });

  it("往上拖不動（sheet 已經在頂）", () => {
    expect(dragOffset(300, 200)).toBe(0);
  });
});

describe("dragRelease（放開）", () => {
  it("超過 120px 放開就收起", () => {
    expect(DISMISS_DISTANCE).toBe(120);
    expect(dragRelease(121, 0)).toBe("dismiss");
  });

  it("不到 120px 回彈", () => {
    expect(dragRelease(120, 0)).toBe("settle");
    expect(dragRelease(40, 0.2)).toBe("settle");
  });

  it("快速往下甩（≥ 0.6px/ms）且拖過 40px 也收起", () => {
    expect(dragRelease(48, 0.8)).toBe("dismiss");
    expect(dragRelease(20, 1.2)).toBe("settle");
  });
});
