import { describe, expect, it, vi } from "vitest";
import {
  buildReading,
  buildTimeline,
  chunk,
  segmentLanguage,
  summarizeTranscript,
  translateSegments,
  type ReadingInputSegment,
} from "./bilingual";

/** 假 LLM：從 prompt 抓出輸入段落 id，回 `譯:<原文>`；可指定要漏掉的 id */
function fakeTranslator(options: { drop?: number[] } = {}) {
  return vi.fn(async (prompt: string) => {
    const items = prompt
      .split("\n")
      .filter((line) => line.startsWith('{"id":'))
      .map((line) => JSON.parse(line) as { id: number; text: string });
    const translations = items
      .filter((item) => !options.drop?.includes(item.id))
      .map((item) => ({ id: item.id, zh: `譯:${item.text}` }));
    return `思考殘留…\n<result>${JSON.stringify({ translations })}</result>`;
  });
}

const EN: ReadingInputSegment[] = [
  { start: 0, end: 2, text: " Hello. " },
  { start: 2, end: 4, text: "This is a test." },
  { start: 4, end: 6, text: "   " },
  { start: 6, end: 8, text: "Third line." },
  { start: 8, end: 10, text: "Fourth line.", speaker: "A" },
  { start: 10, end: 12, text: "Fifth line." },
];

describe("chunk", () => {
  it("依大小切批，最後一批可較短", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("非正整數 batchSize → 丟錯", () => {
    expect(() => chunk([1], 0)).toThrow("batchSize");
    expect(() => chunk([1], 1.5)).toThrow("batchSize");
  });
});

describe("segmentLanguage", () => {
  it("明確標註優先，其次看中文字比例，最後沿用整集語言", () => {
    expect(segmentLanguage({ start: 0, end: 1, text: "Hi", lang: "Japanese" }, "en")).toBe("ja");
    expect(segmentLanguage({ start: 0, end: 1, text: "這是中文 OK" }, "en")).toBe("zh");
    expect(segmentLanguage({ start: 0, end: 1, text: "Plain English" }, "English")).toBe("en");
  });
});

describe("translateSegments", () => {
  it("依 batchSize 分批呼叫 LLM，略過空段，譯文對回原段", async () => {
    const llm = fakeTranslator();
    const onProgress = vi.fn();
    const result = await translateSegments(EN, { language: "en", batchSize: 2, llm, onProgress });

    expect(llm).toHaveBeenCalledTimes(3); // 5 個非空段 / 每批 2
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      start: 0,
      end: 2,
      source_text: "Hello.",
      source_lang: "en",
      translated_text: "譯:Hello.",
    });
    expect(result[3]).toMatchObject({ speaker: "A", translated_text: "譯:Fourth line." });
  });

  it("每批附前文（不翻譯）給語境", async () => {
    const llm = fakeTranslator();
    await translateSegments(EN, { language: "en", batchSize: 2, contextSize: 1, llm });
    const secondPrompt = llm.mock.calls[1][0];
    expect(secondPrompt).toContain("> This is a test.");
  });

  it("只翻非中文分段：中文段不送 LLM、translated_text 為 null", async () => {
    const llm = fakeTranslator();
    const result = await translateSegments(
      [
        { start: 0, end: 1, text: "大家好，歡迎收聽。" },
        { start: 1, end: 2, text: "Welcome to the show." },
      ],
      { language: "en", llm },
    );
    expect(llm).toHaveBeenCalledTimes(1);
    expect(llm.mock.calls[0][0]).not.toContain('"text":"大家好');
    expect(result.map((s) => [s.source_lang, s.translated_text])).toEqual([
      ["zh", null],
      ["en", "譯:Welcome to the show."],
    ]);
  });

  it("整集中文 → 完全不呼叫 LLM", async () => {
    const llm = fakeTranslator();
    const result = await translateSegments([{ start: 0, end: 1, text: "你好" }], { language: "zh", llm });
    expect(llm).not.toHaveBeenCalled();
    expect(result[0].translated_text).toBeNull();
  });

  it("某批漏段 → 整批重試，第二次成功即通過", async () => {
    const bad = fakeTranslator({ drop: [1] });
    const good = fakeTranslator();
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockImplementationOnce(bad)
      .mockImplementation(good);
    const result = await translateSegments(EN.slice(0, 2), { language: "en", llm });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(result[1].translated_text).toBe("譯:This is a test.");
  });

  it("重試耗盡 → 丟錯並標明批次", async () => {
    const llm = fakeTranslator({ drop: [0] });
    await expect(
      translateSegments(EN, { language: "en", batchSize: 2, maxAttempts: 2, llm }),
    ).rejects.toThrow("翻譯第 1/3 批 失敗（嘗試 2 次）：翻譯輸出缺少段落 id：0");
  });

  it("concurrency > 1 仍保持段落順序", async () => {
    const llm = fakeTranslator();
    const result = await translateSegments(EN, { language: "en", batchSize: 1, concurrency: 3, llm });
    expect(result.map((s) => s.translated_text)).toEqual([
      "譯:Hello.",
      "譯:This is a test.",
      "譯:Third line.",
      "譯:Fourth line.",
      "譯:Fifth line.",
    ]);
  });
});

describe("buildTimeline", () => {
  it("短節目以 20 秒窗合併成 [秒數] 行", () => {
    const timeline = buildTimeline([
      { start: 0, end: 5, text: "a" },
      { start: 5, end: 15, text: "b" },
      { start: 25.04, end: 30, text: "c" },
    ]);
    expect(timeline).toBe("[0] a b\n[25] c");
  });

  it("長節目行數不超過上限", () => {
    const segments = Array.from({ length: 1000 }, (_, i) => ({ start: i * 3, end: i * 3 + 3, text: `s${i}` }));
    expect(buildTimeline(segments, 50).split("\n").length).toBeLessThanOrEqual(50);
  });
});

describe("summarizeTranscript / buildReading", () => {
  const overview = `<result>${JSON.stringify({
    summary: [
      { text: "重點一", start: 0 },
      { text: "重點二", start: 7 },
      { text: "重點三", start: 12 },
    ],
    chapters: [
      { title: "開場", start: 0 },
      { title: "第二段", start: 7 },
    ],
  })}</result>`;

  it("摘要 prompt 用時間軸，章節吸附到段落起點", async () => {
    const llm = vi.fn(async (_prompt: string) => overview);
    const result = await summarizeTranscript(EN, { language: "English", llm });
    expect(llm.mock.calls[0][0]).toContain("[0] Hello.");
    expect(result.chapters).toEqual([
      { title: "開場", start: 0 },
      { title: "第二段", start: 6 },
    ]);
    expect(result.summary[1]).toEqual({ text: "重點二", start: 6 });
  });

  it("沒有可用分段 → 丟錯", async () => {
    await expect(
      summarizeTranscript([{ start: 0, end: 1, text: " " }], { language: "en", llm: vi.fn() }),
    ).rejects.toThrow("沒有可用分段");
  });

  it("buildReading 組合雙語 + 摘要 + 章節，語言轉 ISO 碼", async () => {
    const translator = fakeTranslator();
    const llm = vi.fn(async (prompt: string) =>
      prompt.includes('"translations"') ? translator(prompt) : overview,
    );
    const result = await buildReading(EN, { language: "English", batchSize: 10, llm });
    expect(result.language).toBe("en");
    expect(result.segments).toHaveLength(5);
    expect(result.summary).toHaveLength(3);
    expect(result.chapters[0]).toEqual({ title: "開場", start: 0 });
  });
});
