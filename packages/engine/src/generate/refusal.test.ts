import { describe, expect, it } from "vitest";
import { findRefusal, GenerationRefusedError, isRefusal, REFUSAL_MARKER } from "./refusal";

describe("isRefusal", () => {
  it("帶【無法生成】標記就是拒絕（不論出現在開頭或中間）", () => {
    expect(REFUSAL_MARKER).toBe("【無法生成】");
    expect(isRefusal("【無法生成】收到的逐字稿只有一個「.」")).toBe(true);
    expect(isRefusal("# 標題\n\n【無法生成】請提供完整的逐字稿")).toBe(true);
  });

  it("一般文章、空值不是拒絕", () => {
    expect(isRefusal("# 燈亮的時候\n\n我哭了。")).toBe(false);
    expect(isRefusal("")).toBe(false);
    expect(isRefusal(null)).toBe(false);
    expect(isRefusal(undefined)).toBe(false);
  });
});

describe("findRefusal", () => {
  it("回傳第一個帶標記的平台，沒有就 null", () => {
    expect(findRefusal({ threads: "t", blog: "【無法生成】太短" })).toBe("blog");
    expect(findRefusal({ threads: "t", blog: "正文" })).toBeNull();
  });
});

describe("GenerationRefusedError", () => {
  it("帶平台與原文摘要，名稱可辨識", () => {
    const error = new GenerationRefusedError("blog", "【無法生成】收到的逐字稿只有一個「.」");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GenerationRefusedError");
    expect(error.platform).toBe("blog");
    expect(error.message).toContain("原話不足");
  });
});
