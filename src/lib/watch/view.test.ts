import { describe, expect, it } from "vitest";
import { watchSectionView } from "./view";

const netflix = { name: "Netflix", note: "訂閱", url: "https://tmdb/watch" };

describe("watchSectionView", () => {
  it("A 有平台：文字列 + JustWatch 標註", () => {
    const view = watchSectionView({
      podcast: false,
      info: { status: "available", platforms: [netflix], attribution: "資料來源：JustWatch / TMDB" },
    });
    expect(view).toMatchObject({ heading: "在哪看", headerNote: "台灣地區・JustWatch", mode: "list", rows: [netflix] });
    expect(view.footnote).toBe("上架資訊以各平台為準。資料來源：JustWatch / TMDB");
  });

  it("A 列表全是直連／讀者補充（沒有 TMDB 來源）：不標 JustWatch", () => {
    const view = watchSectionView({
      podcast: false,
      info: { status: "available", platforms: [netflix], attribution: null },
    });
    expect(view.headerNote).toBe("台灣地區");
    expect(view.footnote).toBe("上架資訊以各平台為準。");
  });

  it("B 只有院線：帶上映日", () => {
    const view = watchSectionView({
      podcast: false,
      info: { status: "in_theaters", platforms: [], attribution: null, since: "2026-10-03" },
    });
    expect(view).toMatchObject({ mode: "theaters", theatersLine: "院線・10.03 起", headerNote: "台灣地區・TMDB" });
    expect(watchSectionView({ podcast: false, info: { status: "in_theaters", platforms: [], attribution: null } }).theatersLine).toBe("院線");
  });

  it("C 沒有資料", () => {
    const view = watchSectionView({ podcast: false, info: { status: "none", platforms: [], attribution: null } });
    expect(view).toMatchObject({ mode: "none", emptyLine: "這部目前查不到線上平台。", headerNote: "台灣地區" });
  });

  it("D Podcast：在哪聽 + 站內讀逐字稿", () => {
    const apple = { name: "Apple Podcasts", note: "免費", url: "https://podcasts.apple.com/tw/podcast/id1" };
    const view = watchSectionView({
      podcast: true,
      info: { status: "available", platforms: [apple], attribution: null },
      readHref: "/episodes/e1/read",
    });
    expect(view).toMatchObject({ heading: "在哪聽", mode: "list", rows: [apple], readHref: "/episodes/e1/read", emptyLine: null });
  });

  it("Podcast 沒平台也沒逐字稿 → 查不到", () => {
    const view = watchSectionView({ podcast: true, info: { status: "none", platforms: [], attribution: null } });
    expect(view).toMatchObject({ mode: "none", emptyLine: "這個節目目前查不到收聽平台。" });
  });
});
