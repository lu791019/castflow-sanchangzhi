import { describe, expect, it } from "vitest";
import {
  displayAuthor,
  durationFromSegments,
  formatDuration,
  generateShareSlug,
  isListed,
  isShareable,
  nextOrdinal,
  normalizePickedQuote,
  parseByline,
  parseStoredCandidates,
  parseVisibility,
  penNameFromSetting,
  recordedAtLabel,
  SHARE_SLUG_LENGTH,
} from "./publish";

describe("公開範圍與署名", () => {
  it("只接受定義內的值", () => {
    expect(parseVisibility("public")).toBe("public");
    expect(parseVisibility("unlisted")).toBe("unlisted");
    expect(parseVisibility("private")).toBe("private");
    expect(parseVisibility("everyone")).toBeNull();
    expect(parseVisibility(1)).toBeNull();
    expect(parseByline("anonymous")).toBe("anonymous");
    expect(parseByline("real_name")).toBeNull();
  });

  it("只有公開進目錄/特輯；私人不開分享頁", () => {
    expect(isListed("public")).toBe(true);
    expect(isListed("unlisted")).toBe(false);
    expect(isListed("private")).toBe(false);
    expect(isShareable("unlisted")).toBe(true);
    expect(isShareable("private")).toBe(false);
  });

  it("署名：匿名 / 筆名（空白時用預設）", () => {
    expect(displayAuthor("anonymous", "林小晴")).toBe("匿名");
    expect(displayAuthor("pen_name", "林小晴")).toBe("林小晴");
    expect(displayAuthor("pen_name", "  ")).toBe("作者");
  });

  it("筆名從 settings 讀，讀不到用「作者」", () => {
    expect(penNameFromSetting({ pen_name: " 林小晴 " })).toBe("林小晴");
    expect(penNameFromSetting({ pen_name: "" })).toBe("作者");
    expect(penNameFromSetting(null)).toBe("作者");
    expect(penNameFromSetting("x")).toBe("作者");
  });
});

describe("recordedAtLabel", () => {
  it("以台北時間呈現 MM.DD HH:mm 錄下；用打的是寫下", () => {
    expect(recordedAtLabel("2026-10-07T14:41:00Z", "audio")).toBe("10.07 22:41 錄下");
    expect(recordedAtLabel("2026-10-07T16:05:00Z", "text")).toBe("10.08 00:05 寫下");
    expect(recordedAtLabel("not-a-date", "audio")).toBe("");
  });
});

describe("長度", () => {
  it("formatDuration：分秒，未知不顯示", () => {
    expect(formatDuration(134)).toBe("2 分 14 秒");
    expect(formatDuration(120)).toBe("2 分");
    expect(formatDuration(42.4)).toBe("42 秒");
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(null)).toBeNull();
  });

  it("durationFromSegments 取最大 end；用打的（end=0）回傳 null", () => {
    expect(durationFromSegments([{ end: 3 }, { end: 134.2 }, { end: "x" }])).toBe(134.2);
    expect(durationFromSegments([{ start: 0, end: 0, text: "x" }])).toBeNull();
    expect(durationFromSegments("nope")).toBeNull();
  });
});

describe("計數", () => {
  it("nextOrdinal：已有 23 段 → 第 24 段；負數/小數防呆", () => {
    expect(nextOrdinal(23)).toBe(24);
    expect(nextOrdinal(0)).toBe(1);
    expect(nextOrdinal(-3)).toBe(1);
    expect(nextOrdinal(2.7)).toBe(3);
  });
});

describe("generateShareSlug", () => {
  it("固定長度、小寫英數、符合分享頁 slug 格式", () => {
    const slug = generateShareSlug((size) => Uint8Array.from({ length: size }, (_, i) => i * 37));
    expect(slug).toHaveLength(SHARE_SLUG_LENGTH);
    expect(slug).toMatch(/^[a-z0-9]+$/);
    expect(slug).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
  });
});

describe("normalizePickedQuote / parseStoredCandidates", () => {
  it("去引號；空值視為未選；過長或非字串無效", () => {
    expect(normalizePickedQuote("「有些人一直都在。」")).toBe("有些人一直都在。");
    expect(normalizePickedQuote("  ")).toBeNull();
    expect(normalizePickedQuote(null)).toBeNull();
    expect(normalizePickedQuote(5)).toBe("invalid");
    expect(normalizePickedQuote("字".repeat(121))).toBe("invalid");
  });

  it("候選句只留非空字串", () => {
    expect(parseStoredCandidates(["a", "", 3, "b"])).toEqual(["a", "b"]);
    expect(parseStoredCandidates({})).toEqual([]);
  });
});
