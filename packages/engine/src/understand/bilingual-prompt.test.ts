import { describe, expect, it } from "vitest";
import {
  buildOverviewPrompt,
  buildTranslationPrompt,
  extractResultJson,
  parseOverviewOutput,
  parseSummaryPoints,
  parseTranslationOutput,
  snapToSegmentStart,
} from "./bilingual-prompt";

describe("extractResultJson（綁格式標記）", () => {
  it("取標記內 JSON，忽略標記外的雜訊與思考殘留", () => {
    const raw = `好的，以下是結果 {"noise": true}\n<result>{"a": 1}</result>\n完成`;
    expect(extractResultJson(raw)).toEqual({ a: 1 });
  });

  it("容忍標記內的 ```json 圍欄", () => {
    expect(extractResultJson('<result>\n```json\n{"a": 2}\n```\n</result>')).toEqual({ a: 2 });
  });

  it("多組標記時取最後一組（模型先複述 schema 再作答）", () => {
    const raw = '<result>{"a": "schema"}</result> 實際：<result>{"a": "real"}</result>';
    expect(extractResultJson(raw)).toEqual({ a: "real" });
  });

  it("缺標記或非 JSON → 丟錯", () => {
    expect(() => extractResultJson('{"a": 1}')).toThrow("格式標記");
    expect(() => extractResultJson("<result>not json</result>")).toThrow("不是合法 JSON");
  });
});

describe("parseTranslationOutput", () => {
  it("依期望 id 回傳譯文，忽略多餘 id", () => {
    const raw = `<result>${JSON.stringify({
      translations: [
        { id: 3, zh: " 你好 " },
        { id: 4, zh: "世界" },
        { id: 99, zh: "多的" },
      ],
    })}</result>`;
    const result = parseTranslationOutput(raw, [3, 4]);
    expect([...result.entries()]).toEqual([
      [3, "你好"],
      [4, "世界"],
    ]);
  });

  it("缺 id 或空譯文 → 丟錯（交給呼叫端重試）", () => {
    const raw = `<result>${JSON.stringify({ translations: [{ id: 1, zh: "a" }, { id: 2, zh: " " }] })}</result>`;
    expect(() => parseTranslationOutput(raw, [1, 2])).toThrow("缺少段落 id：2");
    expect(() => parseTranslationOutput("<result>{}</result>", [1])).toThrow("translations");
  });
});

describe("parseOverviewOutput", () => {
  const starts = [0, 10.5, 30, 62.2];
  const SUMMARY3 = [
    { text: "一", start: 0 },
    { text: "二", start: 10.5 },
    { text: "三", start: 30 },
  ];

  it("摘要超過 5 條截斷、章節排序並吸附到段落起點", () => {
    const raw = `<result>${JSON.stringify({
      summary: [
        { text: "一", start: 0 },
        { text: "二", start: 9 },
        { text: "三", start: 31 },
        { text: "四", start: 60 },
        { text: "五", start: 61 },
        { text: "六", start: 62 },
      ],
      chapters: [
        { title: "後段", start: 60 },
        { title: "開場", start: 0 },
        { title: "中段", start: 29 },
      ],
    })}</result>`;
    const result = parseOverviewOutput(raw, starts);
    expect(result.summary).toEqual([
      { text: "一", start: 0 },
      { text: "二", start: 10.5 },
      { text: "三", start: 30 },
      { text: "四", start: 62.2 },
      { text: "五", start: 62.2 },
    ]);
    expect(result.chapters).toEqual([
      { title: "開場", start: 0 },
      { title: "中段", start: 30 },
      { title: "後段", start: 62.2 },
    ]);
  });

  it("過濾無效章節、同起點去重", () => {
    const raw = `<result>${JSON.stringify({
      summary: SUMMARY3,
      chapters: [
        { title: "A", start: 0 },
        { title: "A2", start: 1 },
        { title: "", start: 10 },
        { title: "壞", start: "x" },
        { title: "負", start: -5 },
      ],
    })}</result>`;
    expect(parseOverviewOutput(raw, starts).chapters).toEqual([{ title: "A", start: 0 }]);
  });

  it("摘要不足 3 條或無章節 → 丟錯", () => {
    const few = `<result>${JSON.stringify({ summary: SUMMARY3.slice(0, 2), chapters: [{ title: "A", start: 0 }] })}</result>`;
    expect(() => parseOverviewOutput(few, starts)).toThrow("至少需要 3 條");
    const none = `<result>${JSON.stringify({ summary: SUMMARY3, chapters: [] })}</result>`;
    expect(() => parseOverviewOutput(none, starts)).toThrow("章節輸出為空");
  });
});

describe("parseSummaryPoints（摘要時間戳 schema）", () => {
  const starts = [0, 10.5, 30, 62.2];

  it("每條需 text + start，起點吸附段落並依時間排序", () => {
    expect(
      parseSummaryPoints(
        [
          { text: " 後面 ", start: 61 },
          { text: "前面", start: 1 },
        ],
        starts,
      ),
    ).toEqual([
      { text: "前面", start: 0 },
      { text: "後面", start: 62.2 },
    ]);
  });

  it("舊格式純字串、缺 start、負數、非數字、空字串一律無效", () => {
    expect(
      parseSummaryPoints(
        ["舊格式", { text: "缺時間" }, { text: "負", start: -1 }, { text: "字串", start: "12" }, { text: " ", start: 3 }, null],
        starts,
      ),
    ).toEqual([]);
    expect(parseSummaryPoints("not array", starts)).toEqual([]);
  });

  it("舊格式摘要（無時間戳）整份 → 丟錯交給重試", () => {
    const legacy = `<result>${JSON.stringify({ summary: ["一", "二", "三"], chapters: [{ title: "A", start: 0 }] })}</result>`;
    expect(() => parseOverviewOutput(legacy, starts)).toThrow("含時間戳");
  });

  it("摘要 prompt 要求每條附 start", () => {
    const prompt = buildOverviewPrompt("[0] hi", "en", 10);
    expect(prompt).toContain('"text"');
    expect(prompt).toContain('"start"');
  });
});

describe("snapToSegmentStart", () => {
  it("吸附到最近起點；無起點時原值", () => {
    expect(snapToSegmentStart(14, [0, 10, 20])).toBe(10);
    expect(snapToSegmentStart(16, [0, 10, 20])).toBe(20);
    expect(snapToSegmentStart(7, [])).toBe(7);
  });
});

describe("prompts", () => {
  it("翻譯 prompt 帶 id、前文、schema 與格式標記", () => {
    const prompt = buildTranslationPrompt([{ id: 7, text: "Hello there" }], "en", ["Previously"]);
    expect(prompt).toContain('{"id":7,"text":"Hello there"}');
    expect(prompt).toContain("> Previously");
    expect(prompt).toContain('"translations"');
    expect(prompt).toContain("<result>");
  });

  it("摘要 prompt 帶時間軸、長度與 schema", () => {
    const prompt = buildOverviewPrompt("[0] Hi", "en", 120.4);
    expect(prompt).toContain("[0] Hi");
    expect(prompt).toContain("120 秒");
    expect(prompt).toContain('"chapters"');
  });
});
