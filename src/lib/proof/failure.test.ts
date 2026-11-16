import { describe, expect, it } from "vitest";
import { contentFailure } from "./failure";

describe("contentFailure（既有草稿：校樣頁要不要當成整理失敗）", () => {
  it("正文帶【無法生成】且原話太短 → too_short", () => {
    expect(contentFailure("【無法生成】收到的逐字稿只有一個「.」", ".")).toBe("too_short");
  });

  it("正文帶【無法生成】但原話夠長 → refused（可再整理一版）", () => {
    expect(contentFailure("【無法生成】無法辨識", "燈亮的時候我哭了很久很久很久")).toBe("refused");
  });

  it("一般正文 → null；沒有逐字稿時只看正文", () => {
    expect(contentFailure("# 燈亮的時候\n\n我哭了。", ".")).toBeNull();
    expect(contentFailure("【無法生成】", null)).toBe("too_short");
  });
});
