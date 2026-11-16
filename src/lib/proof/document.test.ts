import { describe, expect, it } from "vitest";
import { parseArticle } from "@/lib/share/article";
import {
  isModified,
  normalizeForSave,
  parseProofDocInput,
  paragraphNumber,
  proofPlainText,
  proofQuoteAfter,
  revertTarget,
  serializeProofDoc,
  splitLede,
  toProofDoc,
  updateTarget,
} from "./document";

const BODY = `# 看完《海街日記》，我傳了訊息給姊姊

一部幾乎沒有發生大事的電影，讓她在回家的公車上按下了那句最近好嗎。

燈亮的時候我沒有馬上站起來。

這部片幾乎沒有發生什麼大事。

## 公車上

我想到我姊。

- 梅酒
- 炒飯

最後還是送出去了。
`;

describe("toProofDoc / serializeProofDoc", () => {
  it("拆出標題與 blocks；沒有 # 標題時用 fallback", () => {
    const doc = toProofDoc(BODY, "fallback");
    expect(doc.title).toBe("看完《海街日記》，我傳了訊息給姊姊");
    expect(doc.blocks).toHaveLength(7);
    expect(toProofDoc("只有一段。", "剛看完《海街日記》").title).toBe("剛看完《海街日記》");
  });

  it("序列化後 parseArticle 可原樣讀回（round-trip）", () => {
    const doc = toProofDoc(BODY, "x");
    const again = parseArticle(serializeProofDoc(doc));
    expect(again.title).toBe(doc.title);
    expect(again.blocks).toEqual(doc.blocks);
  });
});

describe("splitLede / paragraphNumber / proofQuoteAfter", () => {
  it("首段夠短當副標，正文段落從 1 起算（不含小標與清單）", () => {
    const doc = toProofDoc(BODY, "x");
    expect(splitLede(doc)).toEqual({ ledeIndex: 0, bodyStart: 1 });
    expect(paragraphNumber(doc, 1)).toBe(1);
    expect(paragraphNumber(doc, 2)).toBe(2);
    expect(paragraphNumber(doc, 4)).toBe(3);
    expect(paragraphNumber(doc, 6)).toBe(4);
  });

  it("引言插入點依正文 block 數（與分享頁同規則）", () => {
    const doc = toProofDoc(BODY, "x");
    expect(proofQuoteAfter(doc)).toBe(3);
  });

  it("首段太短不當副標", () => {
    const doc = toProofDoc("短。\n\n第二段。", "x");
    expect(splitLede(doc)).toEqual({ ledeIndex: null, bodyStart: 0 });
  });
});

describe("編輯與還原", () => {
  const original = toProofDoc(BODY, "x");

  it("改一段 → 只有那段標記已修改，原文件不變（不可變）", () => {
    const edited = updateTarget(original, { kind: "block", index: 4 }, "我想到我姊，還有她寫的菜單。");
    expect(isModified(original, edited, { kind: "block", index: 4 })).toBe(true);
    expect(isModified(original, edited, { kind: "block", index: 1 })).toBe(false);
    expect(original.blocks[4]).toEqual({ type: "paragraph", text: "我想到我姊。" });
  });

  it("還原 → 回到 AI 原版", () => {
    const target = { kind: "block", index: 2 } as const;
    const edited = updateTarget(original, target, "改過了。");
    const reverted = revertTarget(original, edited, target);
    expect(isModified(original, reverted, target)).toBe(false);
    expect(reverted.blocks[2]).toEqual(original.blocks[2]);
  });

  it("標題也可改與還原；只差前後空白不算修改", () => {
    const edited = updateTarget(original, { kind: "title" }, "新標題");
    expect(isModified(original, edited, { kind: "title" })).toBe(true);
    expect(revertTarget(original, edited, { kind: "title" }).title).toBe(original.title);
    const spaced = updateTarget(original, { kind: "title" }, ` ${original.title} `);
    expect(isModified(original, spaced, { kind: "title" })).toBe(false);
  });

  it("清單不可編輯；段數對不上時無法判斷修改", () => {
    expect(updateTarget(original, { kind: "block", index: 5 }, "x")).toBe(original);
    const shorter = { ...original, blocks: original.blocks.slice(0, 3) };
    expect(isModified(original, shorter, { kind: "block", index: 1 })).toBe(false);
  });
});

describe("normalizeForSave / proofPlainText", () => {
  it("移除空段落、壓平段內換行、空標題用 fallback", () => {
    const doc = {
      title: "  ",
      blocks: [
        { type: "paragraph" as const, text: "第一行\n第二行" },
        { type: "paragraph" as const, text: "   " },
      ],
    };
    expect(normalizeForSave(doc, "散場隨筆")).toEqual({
      title: "散場隨筆",
      blocks: [{ type: "paragraph", text: "第一行第二行" }],
    });
  });

  it("parseProofDocInput：接受合法文件，拒絕型別錯誤/未知 block/超長", () => {
    const doc = toProofDoc(BODY, "x");
    expect(parseProofDocInput(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(parseProofDocInput(null)).toBeNull();
    expect(parseProofDocInput({ title: 1, blocks: [] })).toBeNull();
    expect(parseProofDocInput({ title: "t", blocks: [{ type: "image", src: "x" }] })).toBeNull();
    expect(parseProofDocInput({ title: "t", blocks: [{ type: "list", items: [1] }] })).toBeNull();
    expect(
      parseProofDocInput({ title: "t", blocks: [{ type: "paragraph", text: "字".repeat(5001) }] }),
    ).toBeNull();
    expect(parseProofDocInput({ title: "t".repeat(201), blocks: [] })).toBeNull();
  });

  it("純文字正文不含標題", () => {
    const text = proofPlainText(toProofDoc(BODY, "x"));
    expect(text).not.toContain("看完《海街日記》，我傳了");
    expect(text).toContain("梅酒\n炒飯");
  });
});
