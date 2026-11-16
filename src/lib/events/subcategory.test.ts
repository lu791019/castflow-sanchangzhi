import { describe, expect, it } from "vitest";
import { cultureCategoryOf } from "./culture";
import type { SourcedEvent } from "./select";
import { LIVE_SUBCATEGORIES, liveSubcategoryOf, pickBySubcategory, SUBCATEGORY_LIMIT } from "./subcategory";

function sourced(uid: string, overrides: Partial<SourcedEvent> = {}): SourcedEvent {
  const session = { start: "2026-10-20", end: null, time: "19:30", venue: "某場地", city: "臺北市" };
  return { uid, kind: "live", festival: false, title: uid, imageUrl: null, link: null, sessions: [session], session, origin: "kktix", ...overrides };
}

describe("cultureCategoryOf：文化部活動推細類", () => {
  it("展覽一律 exhibition", () => {
    expect(cultureCategoryOf("某某演唱會", "exhibition", "6")).toBe("exhibition");
  });

  it("標題有音樂祭／音樂節／Fest → 音樂祭（不管類別代碼）", () => {
    expect(cultureCategoryOf("2026 浮現音樂祭", "live", "5")).toBe("festival");
    expect(cultureCategoryOf("Taichung Jazz Fest", "live", "17")).toBe("festival");
  });

  it("類別代碼能直接對到的：2 戲劇、3 舞蹈、17 演唱會", () => {
    expect(cultureCategoryOf("夜行", "live", "2")).toBe("theatre");
    expect(cultureCategoryOf("身體", "live", "3")).toBe("dance");
    expect(cultureCategoryOf("某某 LIVE", "live", "17")).toBe("concert");
  });

  it("5 獨立音樂 → 獨立音樂（音樂祭標題仍算音樂祭）", () => {
    expect(cultureCategoryOf("某樂隊 專場", "live", "5")).toBe("indie");
    expect(cultureCategoryOf("某樂團巡迴演唱會", "live", "5")).toBe("indie");
  });

  it("1 音樂看標題；看不出來算一般演出", () => {
    expect(cultureCategoryOf("島嶼夜歌鋼琴獨奏會", "live", "1")).toBe("concert");
    expect(cultureCategoryOf("音樂劇《夜行》", "live", "1")).toBe("theatre");
    expect(cultureCategoryOf("島嶼夜歌", "live", "1")).toBe("performance");
  });

  it("標題像展覽或影展的演出：不改成展覽，照代碼／一般演出", () => {
    expect(cultureCategoryOf("聲音特展", "live", "1")).toBe("performance");
    expect(cultureCategoryOf("城市短片之夜", "live", "1")).toBe("performance");
  });
});

describe("liveSubcategoryOf：演出小標籤用的細類", () => {
  it("有 category 就用；一般演出、展覽不算小標籤", () => {
    expect(liveSubcategoryOf(sourced("a", { category: "theatre" }))).toBe("theatre");
    expect(liveSubcategoryOf(sourced("b", { category: "performance" }))).toBeNull();
    expect(liveSubcategoryOf(sourced("c", { kind: "exhibition", category: "exhibition" }))).toBeNull();
  });

  it("舊資料沒有 category：音樂祭標記 → 音樂祭；否則看標題", () => {
    expect(liveSubcategoryOf(sourced("散場音樂祭", { festival: true }))).toBe("festival");
    expect(liveSubcategoryOf(sourced("某某舞團《光》"))).toBe("dance");
    expect(liveSubcategoryOf(sourced("某某"))).toBeNull();
  });

  it("文化部獨立音樂", () => {
    expect(liveSubcategoryOf(sourced("a", { category: "indie", origin: "culture" }))).toBe("indie");
  });

  it("小標籤順序：演唱會、獨立音樂、戲劇、舞蹈、音樂祭", () => {
    expect(LIVE_SUBCATEGORIES).toEqual(["concert", "indie", "theatre", "dance", "festival"]);
  });
});

describe("pickBySubcategory：每個細類各自取上限，不被演出總上限擠掉", () => {
  it("每類最多 12 張，仍照原順序；一般演出不收", () => {
    const concerts = Array.from({ length: 20 }, (_, index) => sourced(`concert-${index}`, { category: "concert", origin: index % 2 ? "kktix" : "opentix" }));
    const theatre = [sourced("theatre-1", { category: "theatre" })];
    const general = [sourced("general-1", { category: "performance" })];
    const sorted = [theatre[0], ...concerts, general[0]];
    const picked = pickBySubcategory(sorted);
    expect(picked.filter((item) => item.category === "concert")).toHaveLength(SUBCATEGORY_LIMIT);
    expect(picked[0].uid).toBe("theatre-1");
    expect(picked.some((item) => item.uid === "general-1")).toBe(false);
  });

  it("同一類每個出處先最多一半（KKTIX 量大不擠掉文化部）", () => {
    const kktix = Array.from({ length: 15 }, (_, index) => sourced(`k-${index}`, { category: "concert", origin: "kktix" }));
    const fromCulture = Array.from({ length: 3 }, (_, index) => sourced(`c-${index}`, { category: "concert", origin: "culture" }));
    const picked = pickBySubcategory([...kktix, ...fromCulture]);
    expect(picked.filter((item) => item.origin === "culture")).toHaveLength(3);
    expect(picked).toHaveLength(SUBCATEGORY_LIMIT);
  });
});
