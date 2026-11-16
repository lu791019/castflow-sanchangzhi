import { describe, expect, it } from "vitest";
import { transitionClass } from "./page-transition";

describe("transitionClass（換頁動效）", () => {
  it("底部導覽四格與索引：淡入＋輕微位移", () => {
    for (const path of ["/before", "/", "/journal", "/me", "/catalog"]) {
      expect(transitionClass(path)).toBe("p4-tab-shift");
    }
  });

  it("說一段全螢幕頁只淡入", () => {
    expect(transitionClass("/say")).toBe("p4-tab-page");
    expect(transitionClass("/say/new")).toBe("p4-tab-page");
  });

  it("其他頁（下一層）沿用往上 8px 進場", () => {
    expect(transitionClass("/works/abc")).toBe("p4-page");
    expect(transitionClass("/journal/new")).toBe("p4-page");
    expect(transitionClass("/authors/x")).toBe("p4-page");
  });
});
