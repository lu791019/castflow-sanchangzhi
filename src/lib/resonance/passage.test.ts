import { describe, expect, it } from "vitest";
import type { ArticleBlock } from "@/lib/share/article";
import { isPassageHash, listPassages, normalizePassageText, passageHash } from "./passage";

describe("段落正規化與雜湊", () => {
  it("去頭尾空白、連續空白收成一格", () => {
    expect(normalizePassageText("  我胸口\n  一緊。 ")).toBe("我胸口 一緊。");
  });

  it("同一段文字永遠同一個 16 碼 hex 雜湊；空白差異不影響", () => {
    const a = passageHash("看到她們坐在簷廊一起吃飯那一段，我胸口一緊。");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(passageHash(" 看到她們坐在簷廊一起吃飯那一段，我胸口一緊。\n")).toBe(a);
  });

  it("作者改了一個字 → 雜湊不同（舊記號對不上就不顯示）", () => {
    expect(passageHash("我胸口一緊。")).not.toBe(passageHash("我胸口一熱。"));
  });

  it("isPassageHash 只接受 16 碼小寫 hex", () => {
    expect(isPassageHash("0123456789abcdef")).toBe(true);
    expect(isPassageHash("0123456789ABCDEF")).toBe(false);
    expect(isPassageHash("0123")).toBe(false);
    expect(isPassageHash(42)).toBe(false);
  });
});

describe("listPassages：只有正文段落是「段」", () => {
  const blocks: ArticleBlock[] = [
    { type: "paragraph", text: "第一段。" },
    { type: "heading", text: "小標" },
    { type: "list", items: ["一", "二"] },
    { type: "paragraph", text: "第二段。" },
  ];

  it("回傳 block 位置、段序與雜湊；標題與清單不算", () => {
    const passages = listPassages(blocks);
    expect(passages).toEqual([
      { blockIndex: 0, index: 0, text: "第一段。", hash: passageHash("第一段。") },
      { blockIndex: 3, index: 1, text: "第二段。", hash: passageHash("第二段。") },
    ]);
  });

  it("前面插一段，原本的段雜湊不變", () => {
    const edited: ArticleBlock[] = [{ type: "paragraph", text: "新加的開頭。" }, ...blocks];
    const hashes = listPassages(edited).map((passage) => passage.hash);
    expect(hashes).toContain(passageHash("第二段。"));
  });
});
