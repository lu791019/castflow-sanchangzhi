import { describe, expect, it } from "vitest";
import {
  deriveLede,
  extractPullQuote,
  extractWorkTitle,
  formatDotDate,
  issueNumber,
  parseArticle,
  pullQuotePosition,
  stripInlineMarkdown,
  type ArticleBlock,
} from "./article";
import { wavePath } from "./wave";

describe("parseArticle", () => {
  it("抽出開頭 # 標題，## 轉 heading，空行分段", () => {
    const { title, blocks } = parseArticle(
      "# 看完電影之後\n\n第一段文字。\n\n## 小標題\n\n第二段文字。",
    );
    expect(title).toBe("看完電影之後");
    expect(blocks).toEqual([
      { type: "paragraph", text: "第一段文字。" },
      { type: "heading", text: "小標題" },
      { type: "paragraph", text: "第二段文字。" },
    ]);
  });

  it("連續 - 行收成 list，行內粗體標記被剝除", () => {
    const { blocks } = parseArticle("- **重點一**\n- 重點二\n\n收尾*段落*。");
    expect(blocks).toEqual([
      { type: "list", items: ["重點一", "重點二"] },
      { type: "paragraph", text: "收尾段落。" },
    ]);
  });

  it("非開頭的 # 行當一般 heading，不搶 title", () => {
    const { title, blocks } = parseArticle("開場段。\n\n# 中段大標\n\n結尾。");
    expect(title).toBeNull();
    expect(blocks[1]).toEqual({ type: "heading", text: "中段大標" });
  });
});

describe("stripInlineMarkdown", () => {
  it("剝除連結與行內碼，保留文字", () => {
    expect(stripInlineMarkdown("看[這部片](https://x.tw)的`感受`")).toBe(
      "看這部片的感受",
    );
  });
});

describe("extractPullQuote", () => {
  it("取第一句 20–60 字的句子", () => {
    const blocks: ArticleBlock[] = [
      { type: "paragraph", text: "短句。有些人一直都在，只是我很久沒有好好看她，很久很久。太短。" },
    ];
    expect(extractPullQuote(blocks)).toBe(
      "有些人一直都在，只是我很久沒有好好看她，很久很久。",
    );
  });

  it("跳過 heading，全部句子不合長度時回傳 null", () => {
    const blocks: ArticleBlock[] = [
      { type: "heading", text: "這個標題的長度其實落在二十到六十字之間但它不是段落" },
      { type: "paragraph", text: "太短。" },
    ];
    expect(extractPullQuote(blocks)).toBeNull();
  });
});

describe("extractWorkTitle", () => {
  it("從多段文字取第一個書名號內容", () => {
    expect(extractWorkTitle("沒有書名號", "看完《海街日記》之後")).toBe(
      "海街日記",
    );
    expect(extractWorkTitle("都沒有")).toBeNull();
  });
});

describe("deriveLede", () => {
  it("首段 20–90 字抽成副標並從正文移除", () => {
    const blocks: ArticleBlock[] = [
      { type: "paragraph", text: "一部幾乎沒有發生大事的電影，讓她按下了那句「最近好嗎」。" },
      { type: "paragraph", text: "正文第一段。" },
    ];
    const result = deriveLede(blocks);
    expect(result.lede).toContain("最近好嗎");
    expect(result.blocks).toHaveLength(1);
  });

  it("首段過長或無後續段落時不抽", () => {
    const long: ArticleBlock[] = [
      { type: "paragraph", text: "長".repeat(120) },
      { type: "paragraph", text: "後續。" },
    ];
    expect(deriveLede(long).lede).toBeNull();
    expect(deriveLede(long).blocks).toHaveLength(2);
  });
});

describe("pullQuotePosition / issueNumber / formatDotDate", () => {
  it("插入點不超過 3、至少 1", () => {
    const paragraph: ArticleBlock = { type: "paragraph", text: "x" };
    expect(pullQuotePosition([paragraph, paragraph])).toBe(1);
    expect(pullQuotePosition(Array(10).fill(paragraph))).toBe(3);
  });

  it("期數穩定且落在 1000–9999", () => {
    const id = "a1b2c3d4-0000-0000-0000-000000000000";
    expect(issueNumber(id)).toBe(issueNumber(id));
    expect(Number(issueNumber(id))).toBeGreaterThanOrEqual(1000);
    expect(Number(issueNumber(id))).toBeLessThanOrEqual(9999);
  });

  it("日期格式 YYYY.MM.DD", () => {
    expect(formatDotDate("2026-10-07T12:00:00+08:00")).toMatch(
      /^2026\.10\.0[67]$/,
    );
  });
});

describe("wavePath", () => {
  it("重現設計稿的 pull quote 波形字串", () => {
    expect(wavePath({ y: 7, amplitude: 6, halfPeriod: 15, width: 60 })).toBe(
      "M0 7 Q7.5 1 15 7 T30 7 T45 7 T60 7",
    );
  });

  it("支援負的起點（漂移回捲的第三條波）", () => {
    expect(
      wavePath({ y: 50, amplitude: 6, halfPeriod: 40, width: 40, startX: -80 }),
    ).toBe("M-80 50 Q-60 44 -40 50 T0 50 T40 50");
  });
});
