import { describe, expect, it, vi } from "vitest";
import { pickQuoteCandidates } from "./quote-candidates";
import {
  buildQuoteCandidatesPrompt,
  comparableText,
  parseQuoteCandidatesOutput,
} from "./quote-candidates-prompt";

const ARTICLE = [
  "燈亮的時候我沒有馬上站起來。旁邊的人都在穿外套了，我還坐著，覺得如果現在站起來，有什麼東西會掉在地上。",
  "散場後我在公車上把手機拿出來，打了一句「最近好嗎」。她回了一個貼圖，是一隻在吃飯的貓。",
  "這部片沒有教我什麼道理。它只是讓我想起，有些人一直都在，只是我很久沒有好好看她。",
].join("\n\n");

const wrap = (json: unknown) => `思考殘留……\n<result>${JSON.stringify(json)}</result>`;

const GOOD = {
  quotes: [
    "有些人一直都在，只是我很久沒有好好看她。",
    "「覺得如果現在站起來，有什麼東西會掉在地上。」",
    "她回了一個貼圖，是一隻在吃飯的貓。",
  ],
};

describe("buildQuoteCandidatesPrompt", () => {
  it("帶入正文、schema 與格式標記", () => {
    const prompt = buildQuoteCandidatesPrompt(ARTICLE);
    expect(prompt).toContain(ARTICLE);
    expect(prompt).toContain('"quotes"');
    expect(prompt).toContain("<result>");
    expect(prompt).toContain("逐字照抄");
  });
});

describe("parseQuoteCandidatesOutput", () => {
  it("取格式標記內的 3 句並去掉外層引號", () => {
    expect(parseQuoteCandidatesOutput(wrap(GOOD), ARTICLE)).toEqual([
      "有些人一直都在，只是我很久沒有好好看她。",
      "覺得如果現在站起來，有什麼東西會掉在地上。",
      "她回了一個貼圖，是一隻在吃飯的貓。",
    ]);
  });

  it("容忍 ```json 圍欄", () => {
    const raw = `<result>\n\`\`\`json\n${JSON.stringify(GOOD)}\n\`\`\`\n</result>`;
    expect(parseQuoteCandidatesOutput(raw, ARTICLE)).toHaveLength(3);
  });

  it("缺少格式標記 → 丟錯（不靠內容長相抓 JSON）", () => {
    expect(() => parseQuoteCandidatesOutput(JSON.stringify(GOOD), ARTICLE)).toThrow(/格式標記/);
  });

  it("缺 quotes 陣列 → 丟錯", () => {
    expect(() => parseQuoteCandidatesOutput(wrap({ items: [] }), ARTICLE)).toThrow(/quotes/);
  });

  it("模型改寫或捏造的句子不算數，不足 3 句丟錯", () => {
    const raw = wrap({
      quotes: [GOOD.quotes[0], GOOD.quotes[2], "我終於明白家人的重要，人生就是這樣。"],
    });
    expect(() => parseQuoteCandidatesOutput(raw, ARTICLE)).toThrow(/2 句合格/);
  });

  it("重複、過短、過長與非字串會被濾掉；多於 3 句截斷", () => {
    const raw = wrap({
      quotes: [
        42,
        "貓。",
        GOOD.quotes[0],
        "有些人一直都在只是我很久沒有好好看她",
        GOOD.quotes[1],
        GOOD.quotes[2],
        "這部片沒有教我什麼道理。",
      ],
    });
    expect(parseQuoteCandidatesOutput(raw, ARTICLE)).toEqual([
      "有些人一直都在，只是我很久沒有好好看她。",
      "覺得如果現在站起來，有什麼東西會掉在地上。",
      "她回了一個貼圖，是一隻在吃飯的貓。",
    ]);
  });

  it("標點換成半形仍視為原句", () => {
    expect(comparableText("最近好嗎, 她說!")).toBe(comparableText("最近好嗎，她說！"));
  });
});

describe("pickQuoteCandidates", () => {
  it("第一次不合格會重試，第二次成功", async () => {
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("沒有標記")
      .mockResolvedValueOnce(wrap(GOOD));
    const quotes = await pickQuoteCandidates(ARTICLE, { llm });
    expect(quotes).toHaveLength(3);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("全部失敗時丟出含嘗試次數的錯誤", async () => {
    const llm = vi.fn(async () => "壞掉了");
    await expect(pickQuoteCandidates(ARTICLE, { llm, maxAttempts: 3 })).rejects.toThrow(/嘗試 3 次/);
    expect(llm).toHaveBeenCalledTimes(3);
  });

  it("空正文直接丟錯、不呼叫 LLM", async () => {
    const llm = vi.fn(async () => wrap(GOOD));
    await expect(pickQuoteCandidates("   ", { llm })).rejects.toThrow(/空/);
    expect(llm).not.toHaveBeenCalled();
  });
});
