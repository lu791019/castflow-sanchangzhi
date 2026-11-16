import { describe, expect, it, vi } from "vitest";
import { buildGuessPrompt, guessWork, guessLead, parseGuessOutput } from "./guess";

const wrap = (json: string) => `好的。\n<result>\n${json}\n</result>`;

describe("parseGuessOutput", () => {
  it("合法輸出轉成 WorkGuess；字串修剪", () => {
    const raw = wrap('{"title":" 師父 ","originalTitle":"The Final Master","kind":"movie","year":2015}');
    expect(parseGuessOutput(raw)).toEqual({ title: "師父", originalTitle: "The Final Master", kind: "movie", year: 2015 });
  });

  it("容忍 ```json 包裝與 null 欄位", () => {
    const raw = wrap('```json\n{"title":"人聲","originalTitle":null,"kind":"movie","year":null}\n```');
    expect(parseGuessOutput(raw)).toEqual({ title: "人聲", originalTitle: null, kind: "movie", year: null });
  });

  it("判斷不出作品 → title 為 null、kind 為 unknown", () => {
    expect(parseGuessOutput(wrap('{"title":null,"originalTitle":null,"kind":"unknown","year":null}'))).toEqual({
      title: null,
      originalTitle: null,
      kind: "unknown",
      year: null,
    });
  });

  it("不在 schema 的值：kind 錯、year 不合理、型別錯 → 丟錯讓呼叫端重試", () => {
    expect(() => parseGuessOutput(wrap('{"title":"x","originalTitle":null,"kind":"book","year":null}'))).toThrow(/kind/);
    expect(() => parseGuessOutput(wrap('{"title":"x","originalTitle":null,"kind":"movie","year":1700}'))).toThrow(/year/);
    expect(() => parseGuessOutput(wrap('{"title":3,"originalTitle":null,"kind":"movie","year":null}'))).toThrow(/title/);
    expect(() => parseGuessOutput("師父 2015")).toThrow(/格式標記/);
  });

  it("year 給字串數字也收", () => {
    expect(parseGuessOutput(wrap('{"title":"樹大招風","originalTitle":null,"kind":"movie","year":"2016"}')).year).toBe(2016);
  });
});

describe("guessLead／buildGuessPrompt", () => {
  it("只帶標題與前段正文（≤ 1200 字），schema 交給模型", () => {
    const lead = guessLead([{ type: "paragraph", text: "甲".repeat(800) }, { type: "paragraph", text: "乙".repeat(800) }]);
    expect(lead.length).toBe(1200);
    const prompt = buildGuessPrompt("《師父》影評", lead);
    expect(prompt).toContain("《師父》影評");
    expect(prompt).toContain('"kind"');
    expect(prompt).toContain("<result>");
  });
});

describe("guessWork", () => {
  it("第一次不合格會重試一次", async () => {
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("我覺得是師父")
      .mockResolvedValueOnce(wrap('{"title":"師父","originalTitle":null,"kind":"movie","year":2015}'));
    await expect(guessWork({ title: "t", lead: "l" }, llm)).resolves.toMatchObject({ title: "師父", year: 2015 });
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("兩次都失敗 → 丟錯（由呼叫端推警報）", async () => {
    const llm = vi.fn<(prompt: string) => Promise<string>>().mockRejectedValue(new Error("逾時"));
    await expect(guessWork({ title: "t", lead: "l" }, llm)).rejects.toThrow(/判斷作品失敗.*逾時/);
  });
});
