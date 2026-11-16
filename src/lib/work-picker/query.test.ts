import { describe, expect, it } from "vitest";
import {
  MIN_QUERY_LENGTH,
  QUERY_MAX_LENGTH,
  createSequencer,
  normalizeQuery,
  queryGate,
  splitHighlight,
} from "./query";

describe("normalizeQuery", () => {
  it("去頭尾空白、壓縮連續空白", () => {
    expect(normalizeQuery("  海街  日記 ")).toBe("海街 日記");
  });
  it("超過上限截斷", () => {
    expect(normalizeQuery("a".repeat(QUERY_MAX_LENGTH + 20))).toHaveLength(QUERY_MAX_LENGTH);
  });
  it("非字串回空字串", () => {
    expect(normalizeQuery(undefined)).toBe("");
  });
});

describe("queryGate", () => {
  it("空字串 → empty", () => {
    expect(queryGate("")).toBe("empty");
    expect(queryGate("   ")).toBe("empty");
  });
  it("1 字 → too_short（至少 2 字才搜）", () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(queryGate("海")).toBe("too_short");
  });
  it("2 字以上 → ok；以 code point 計（emoji 算 1 字）", () => {
    expect(queryGate("海街")).toBe("ok");
    expect(queryGate("😀")).toBe("too_short");
    expect(queryGate("😀😀")).toBe("ok");
  });
});

describe("createSequencer", () => {
  it("只有最新序號算有效，舊回應被丟掉", () => {
    const seq = createSequencer();
    const first = seq.next();
    const second = seq.next();
    expect(seq.isLatest(first)).toBe(false);
    expect(seq.isLatest(second)).toBe(true);
  });
  it("invalidate 後連最新序號也失效（例如查詢被清空）", () => {
    const seq = createSequencer();
    const id = seq.next();
    seq.invalidate();
    expect(seq.isLatest(id)).toBe(false);
  });
});

describe("splitHighlight", () => {
  it("命中的片段標記 hit，其餘照原文", () => {
    expect(splitHighlight("海街日記", "海")).toEqual([
      { text: "海", hit: true },
      { text: "街日記", hit: false },
    ]);
  });
  it("大小寫不敏感且保留原文大小寫", () => {
    expect(splitHighlight("Manchester by the Sea", "sea")).toEqual([
      { text: "Manchester by the ", hit: false },
      { text: "Sea", hit: true },
    ]);
  });
  it("沒命中或空查詢 → 單一段", () => {
    expect(splitHighlight("海街日記", "")).toEqual([{ text: "海街日記", hit: false }]);
    expect(splitHighlight("海街日記", "xyz")).toEqual([{ text: "海街日記", hit: false }]);
  });
});
