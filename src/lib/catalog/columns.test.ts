import { describe, expect, it } from "vitest";
import { assignColumns, CATALOG_COLUMNS, columnOf, parseColumnKey } from "./columns";

describe("columnOf（欄目歸屬，優先序：現場 → 一集一句 → 重看 → 影集通勤 → 隨筆）", () => {
  it("演出、展覽 → 現場（含 p3-venue 新增的 performance）", () => {
    expect(columnOf({ workKind: "live", isRewatch: false })).toBe("onsite");
    expect(columnOf({ workKind: "performance", isRewatch: false })).toBe("onsite");
    expect(columnOf({ workKind: "exhibition", isRewatch: true })).toBe("onsite");
  });
  it("Podcast 單集 → 一集一句（重聽不算重看）", () => {
    expect(columnOf({ workKind: "podcast_episode", isRewatch: false })).toBe("one_line");
    expect(columnOf({ workKind: "podcast_episode", isRewatch: true })).toBe("one_line");
  });
  it("同一位作者第二次寫同一部電影／影集 → 重看", () => {
    expect(columnOf({ workKind: "movie", isRewatch: true })).toBe("rewatch");
    expect(columnOf({ workKind: "series", isRewatch: true })).toBe("rewatch");
  });
  it("影集 → 影集通勤；電影與沒綁作品 → 散場之後・隨筆", () => {
    expect(columnOf({ workKind: "series", isRewatch: false })).toBe("commute");
    expect(columnOf({ workKind: "movie", isRewatch: false })).toBe("essay");
    expect(columnOf({ workKind: null, isRewatch: false })).toBe("essay");
    expect(columnOf({ workKind: "unknown-kind", isRewatch: false })).toBe("essay");
  });
});

describe("assignColumns（重看＝同作者、同作品、較早已有一篇公開文章）", () => {
  const base = { workKind: "movie" as string | null };
  it("第一篇是隨筆、第二篇起是重看；不同作者互不影響", () => {
    const result = assignColumns([
      { ...base, id: "b", userId: "u1", workId: "w1", publishedAt: "2026-10-09T00:00:00Z" },
      { ...base, id: "a", userId: "u1", workId: "w1", publishedAt: "2026-10-01T00:00:00Z" },
      { ...base, id: "c", userId: "u2", workId: "w1", publishedAt: "2026-10-10T00:00:00Z" },
    ]);
    expect(result.get("a")).toBe("essay");
    expect(result.get("b")).toBe("rewatch");
    expect(result.get("c")).toBe("essay");
  });
  it("沒綁作品的文章不會互相算重看", () => {
    const result = assignColumns([
      { id: "a", userId: "u1", workId: null, workKind: null, publishedAt: "2026-10-01T00:00:00Z" },
      { id: "b", userId: "u1", workId: null, workKind: null, publishedAt: "2026-10-02T00:00:00Z" },
    ]);
    expect([result.get("a"), result.get("b")]).toEqual(["essay", "essay"]);
  });
  it("不改動傳入的陣列", () => {
    const input = Object.freeze([
      Object.freeze({ ...base, id: "b", userId: "u1", workId: "w1", publishedAt: "2026-10-09T00:00:00Z" }),
      Object.freeze({ ...base, id: "a", userId: "u1", workId: "w1", publishedAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(() => assignColumns(input)).not.toThrow();
    expect(input[0].id).toBe("b");
  });
});

describe("欄目表與網址參數", () => {
  it("五個固定欄目，隨筆在最前（主欄）", () => {
    expect(CATALOG_COLUMNS.map((column) => column.name)).toEqual([
      "散場之後・隨筆",
      "影集通勤",
      "一集一句",
      "現場",
      "重看",
    ]);
  });
  it("parseColumnKey 只認已知 key", () => {
    expect(parseColumnKey("rewatch")).toBe("rewatch");
    expect(parseColumnKey("x")).toBeNull();
    expect(parseColumnKey(undefined)).toBeNull();
  });
});
