import { describe, expect, it } from "vitest";
import { ALL_VIEW_LIMIT } from "@/lib/before/filter";
import {
  allViewLimit,
  BEFORE_GRID_COLUMNS,
  beforeAllLimits,
  headlineScale,
  maxOf,
  SHELF_COLUMNS,
  trimClass,
  WIDE_ALL_VIEW_MAX,
} from "./layout";

describe("allViewLimit", () => {
  it("兩欄（手機、1024）維持手機的張數", () => {
    expect(allViewLimit(2)).toBe(ALL_VIEW_LIMIT);
    expect(allViewLimit(1)).toBe(ALL_VIEW_LIMIT);
  });

  it("三欄以上：每列排滿、最多 18 張", () => {
    expect(allViewLimit(3)).toBe(18);
    expect(allViewLimit(4)).toBe(16);
    expect(allViewLimit(5)).toBe(15);
    expect(allViewLimit(6)).toBe(18);
    expect(allViewLimit(7)).toBe(14);
  });

  it("任何欄數都排滿整列、不超過上限", () => {
    for (let columns = 3; columns <= 9; columns += 1) {
      const limit = allViewLimit(columns);
      expect(limit % columns).toBe(0);
      expect(limit).toBeLessThanOrEqual(WIDE_ALL_VIEW_MAX);
    }
  });
});

describe("beforeAllLimits", () => {
  it("手機與平板不動；1024 兩欄 12、1280 三欄 18、1440 四欄 16", () => {
    expect(beforeAllLimits()).toEqual({ base: ALL_VIEW_LIMIT, lg: 12, xl: 18, wide: 16 });
  });

  it("欄數表跟 grid 一致：手機 2、1024 2、1280 3、1440 4", () => {
    expect(BEFORE_GRID_COLUMNS).toEqual({ base: 2, lg: 2, xl: 3, wide: 4 });
  });

  it("maxOf：要先 render 幾張", () => {
    expect(maxOf(beforeAllLimits())).toBe(18);
  });
});

describe("trimClass", () => {
  const limits = beforeAllLimits();

  it("前 12 張每個寬度都看得到", () => {
    expect(trimClass(0, limits)).toBe("");
    expect(trimClass(11, limits)).toBe("");
  });

  it("第 13–16 張：手機、平板、1024 藏起來，1280 以上出現", () => {
    expect(trimClass(12, limits)).toBe("max-lg:hidden lg:max-xl:hidden");
    expect(trimClass(15, limits)).toBe("max-lg:hidden lg:max-xl:hidden");
  });

  it("第 17–18 張：只有 1280–1439 三欄（18 張）出現，1440 四欄排滿 16 張就收", () => {
    expect(trimClass(16, limits)).toBe("max-lg:hidden lg:max-xl:hidden min-[90rem]:hidden");
    expect(trimClass(17, limits)).toBe("max-lg:hidden lg:max-xl:hidden min-[90rem]:hidden");
  });

  it("海報架一列：1024 五張、1280 六張、1440 七張", () => {
    expect(SHELF_COLUMNS).toEqual({ base: 5, lg: 5, xl: 6, wide: 7 });
    expect(trimClass(4, SHELF_COLUMNS)).toBe("");
    expect(trimClass(5, SHELF_COLUMNS)).toBe("max-lg:hidden lg:max-xl:hidden");
    expect(trimClass(6, SHELF_COLUMNS)).toBe("max-lg:hidden lg:max-xl:hidden xl:max-[90rem]:hidden");
  });
});

describe("headlineScale", () => {
  it("片名式短標題（≤6 字）用最大字", () => {
    expect(headlineScale("樹大招風")).toBe("short");
    expect(headlineScale("一二三四五六")).toBe("short");
  });

  it("一般標題（7–14 字）中字、長標題小字", () => {
    expect(headlineScale("看完樹大招風的那個晚上")).toBe("medium");
    expect(headlineScale("看完《樹大招風》，最留下來的是小人物三個字")).toBe("long");
  });

  it("英文以字元數算、前後空白不算", () => {
    expect(headlineScale("  Night  ")).toBe("short");
  });
});
