import { describe, expect, it } from "vitest";
import { buildEmbeddingText, contentHash, EMBEDDING_MAX_CHARS } from "./text";

describe("buildEmbeddingText", () => {
  it("標題＋作品名＋全文（去掉 Markdown 標記）", () => {
    const text = buildEmbeddingText({
      title: "舊標題",
      workTitle: "花樣年華",
      body: "# 走出戲院那晚\n\n第一段**很長**。\n\n## 小標\n\n- 一\n- 二\n",
    });
    expect(text).toBe("走出戲院那晚\n《花樣年華》\n\n第一段很長。\n小標\n一\n二");
  });

  it("正文沒有 # 標題時用文章標題；沒有作品就不寫作品行", () => {
    expect(buildEmbeddingText({ title: "散場", workTitle: null, body: "只有一段。" })).toBe("散場\n\n只有一段。");
  });

  it("沒有正文也沒有標題 → 空字串（不算）", () => {
    expect(buildEmbeddingText({ title: " ", workTitle: null, body: null })).toBe("");
  });

  it("截到 EMBEDDING_MAX_CHARS 個字（以字元計，不切壞中文）", () => {
    const text = buildEmbeddingText({ title: "題", workTitle: null, body: "字".repeat(EMBEDDING_MAX_CHARS * 2) });
    expect(Array.from(text)).toHaveLength(EMBEDDING_MAX_CHARS);
    expect(text.startsWith("題\n\n字")).toBe(true);
  });
});

describe("contentHash", () => {
  it("同模型同文字 → 同 hash；改文字或換模型都會變", () => {
    const hash = contentHash("voyage-3", "一段話");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash("voyage-3", "一段話")).toBe(hash);
    expect(contentHash("voyage-3", "一段話。")).not.toBe(hash);
    expect(contentHash("voyage-3-large", "一段話")).not.toBe(hash);
  });
});
