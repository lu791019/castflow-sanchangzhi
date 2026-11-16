import { describe, expect, it } from "vitest";
import { LIVE_KIND_LABELS, parseStoredLiveKinds, tasteLiveKey, toggleLiveKind } from "./live-kinds";

describe("tasteLiveKey（每人一列，存在既有 settings 表，同 taste_picks 寫法）", () => {
  it("taste_live:<userId>", () => {
    expect(tasteLiveKey("u1")).toBe("taste_live:u1");
  });
});

describe("LIVE_KIND_LABELS：沿用散場之前演出細分類", () => {
  it("演唱會／獨立音樂／戲劇／舞蹈／音樂祭，照小標籤順序", () => {
    expect(Object.entries(LIVE_KIND_LABELS)).toEqual([
      ["concert", "演唱會"],
      ["indie", "獨立音樂"],
      ["theatre", "戲劇"],
      ["dance", "舞蹈"],
      ["festival", "音樂祭"],
    ]);
  });
});

describe("parseStoredLiveKinds：讀回來的值也要過白名單", () => {
  it("合法細類；去重、照固定順序", () => {
    expect(parseStoredLiveKinds({ kinds: ["festival", "concert", "festival"] })).toEqual(["concert", "festival"]);
  });

  it("沒有、壞資料 → 空陣列；清單外的丟掉", () => {
    expect(parseStoredLiveKinds(undefined)).toEqual([]);
    expect(parseStoredLiveKinds(null)).toEqual([]);
    expect(parseStoredLiveKinds({ kinds: "concert" })).toEqual([]);
    expect(parseStoredLiveKinds({ kinds: ["opera", "dance", 3] })).toEqual(["dance"]);
  });
});

describe("toggleLiveKind：點一下加入／移除，順序固定", () => {
  it("加入後照清單順序", () => {
    expect(toggleLiveKind(["festival"], "concert")).toEqual(["concert", "festival"]);
  });

  it("再點一次移除", () => {
    expect(toggleLiveKind(["concert", "dance"], "concert")).toEqual(["dance"]);
  });
});
