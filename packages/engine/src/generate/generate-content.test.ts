import { beforeEach, describe, expect, it, vi } from "vitest";

const runClaudePrint = vi.fn();
vi.mock("../llm/client", () => ({
  runClaudePrint: (...args: unknown[]) => runClaudePrint(...args),
}));

import { BLOG_MAX_CHARS, buildShortenPrompt, countChineseChars, isOverBlogLimit } from "./article-length";
import { PLATFORM_SPECS } from "./generate-content-prompt";
import { generateAllPlatforms, generateSinglePlatform } from "./generate-content";
import { GenerationRefusedError } from "./refusal";

const han = (n: number) => "字".repeat(n);

function allPlatforms(blog: string): string {
  return JSON.stringify({
    threads: "t",
    facebook: "f",
    instagram: "i",
    linkedin: "l",
    blog,
    newsletter: "n",
  });
}

describe("countChineseChars", () => {
  it("只計漢字，不算標點、空白、Markdown 與英數", () => {
    expect(countChineseChars("# 標題\n\n燈亮的時候，我哭了。OK 123")).toBe(10);
    expect(countChineseChars("")).toBe(0);
  });

  it("上限判斷以 600 為界", () => {
    expect(BLOG_MAX_CHARS).toBe(600);
    expect(isOverBlogLimit(han(600))).toBe(false);
    expect(isOverBlogLimit(han(601))).toBe(true);
  });

  it("重試提示帶實際字數與上限", () => {
    const prompt = buildShortenPrompt("BASE", han(900));
    expect(prompt).toContain("BASE");
    expect(prompt).toContain("900 字，超過 600 字上限");
  });
});

describe("blog prompt 規範", () => {
  it("寫明 600 字、3–6 段、不得虛構，其他平台不動", () => {
    const blog = PLATFORM_SPECS.blog;
    expect(blog.maxChars).toBe(BLOG_MAX_CHARS);
    expect(blog.guidelines).toContain("600 字以內");
    expect(blog.guidelines).toContain("3–6 段");
    expect(blog.guidelines).toContain("不得虛構");
    expect(PLATFORM_SPECS.threads.maxChars).toBe(500);
    expect(PLATFORM_SPECS.newsletter.maxChars).toBe(5000);
  });
});

describe("generateAllPlatforms 字數保護", () => {
  beforeEach(() => runClaudePrint.mockReset());

  it("未超過：不重試、不警告", async () => {
    runClaudePrint.mockResolvedValueOnce(allPlatforms(han(300)));
    const notify = vi.fn();
    const result = await generateAllPlatforms("原話", undefined, { notify });
    expect(result.blog).toBe(han(300));
    expect(runClaudePrint).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("超過：重試一次帶縮短提示，重試後合格就採用", async () => {
    runClaudePrint
      .mockResolvedValueOnce(allPlatforms(han(900)))
      .mockResolvedValueOnce(han(500));
    const notify = vi.fn();
    const result = await generateAllPlatforms("原話", undefined, { notify });
    expect(result.blog).toBe(han(500));
    expect(result.threads).toBe("t");
    expect(runClaudePrint).toHaveBeenCalledTimes(2);
    expect(runClaudePrint.mock.calls[1][0]).toContain("900 字，超過 600 字上限");
    expect(notify).not.toHaveBeenCalled();
  });

  it("重試仍超過：保留重試結果（不截斷）並 notify warn", async () => {
    runClaudePrint
      .mockResolvedValueOnce(allPlatforms(han(900)))
      .mockResolvedValueOnce(han(700));
    const notify = vi.fn();
    const result = await generateAllPlatforms("原話", undefined, { notify });
    expect(result.blog).toBe(han(700));
    expect(runClaudePrint).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      "warn",
      "Blog 文章超過字數上限",
      expect.stringContaining("首次 900 字、重試後 700 字"),
    );
  });

  it("重試回空白：沿用首次結果並警告", async () => {
    runClaudePrint
      .mockResolvedValueOnce(allPlatforms(han(900)))
      .mockResolvedValueOnce("  ");
    const notify = vi.fn();
    const result = await generateAllPlatforms("原話", undefined, { notify });
    expect(result.blog).toBe(han(900));
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe("generateSinglePlatform 字數保護", () => {
  beforeEach(() => runClaudePrint.mockReset());

  it("blog 超過會重試", async () => {
    runClaudePrint.mockResolvedValueOnce(han(800)).mockResolvedValueOnce(han(400));
    const result = await generateSinglePlatform("原話", "blog", undefined, { notify: vi.fn() });
    expect(result).toBe(han(400));
    expect(runClaudePrint).toHaveBeenCalledTimes(2);
  });

  it("其他平台不套用 blog 上限", async () => {
    runClaudePrint.mockResolvedValueOnce(han(800));
    const result = await generateSinglePlatform("原話", "facebook", undefined, { notify: vi.fn() });
    expect(result).toBe(han(800));
    expect(runClaudePrint).toHaveBeenCalledTimes(1);
  });
});

describe("拒絕標記【無法生成】視為失敗", () => {
  beforeEach(() => runClaudePrint.mockReset());

  it("generateAllPlatforms：blog 帶標記 → notify warn 並拋 GenerationRefusedError，不重試", async () => {
    runClaudePrint.mockResolvedValueOnce(allPlatforms("【無法生成】收到的逐字稿只有一個「.」"));
    const notify = vi.fn();
    await expect(generateAllPlatforms(".", undefined, { notify })).rejects.toBeInstanceOf(GenerationRefusedError);
    expect(runClaudePrint).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("warn", "AI 沒有整理出文章（原話不足）", expect.stringContaining("blog"));
  });

  it("generateSinglePlatform：帶標記同樣拋錯並警報", async () => {
    runClaudePrint.mockResolvedValueOnce("【無法生成】請提供完整的逐字稿");
    const notify = vi.fn();
    await expect(generateSinglePlatform(".", "blog", undefined, { notify })).rejects.toBeInstanceOf(GenerationRefusedError);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("generateAllPlatforms：只有社群平台帶標記（如觀影感想不適合 LinkedIn）→ 文章照常產出，該平台留空、不警報", async () => {
    runClaudePrint.mockResolvedValueOnce(
      JSON.stringify({
        threads: "t",
        facebook: "f",
        instagram: "i",
        linkedin: "【無法生成】逐字稿內容為個人觀影的情感記憶，缺乏職場洞見素材",
        blog: han(100),
        newsletter: "n",
      }),
    );
    const notify = vi.fn();
    const results = await generateAllPlatforms("原話", undefined, { notify });
    expect(results.blog).toBe(han(100));
    expect(results.linkedin).toBe("");
    expect(results.threads).toBe("t");
    expect(notify).not.toHaveBeenCalled();
  });

  it("generateAllPlatforms：文章與社群平台都帶標記 → 仍以文章拒絕為準拋錯", async () => {
    runClaudePrint.mockResolvedValueOnce(
      JSON.stringify({ threads: "【無法生成】x", facebook: "f", instagram: "i", linkedin: "【無法生成】y", blog: "【無法生成】太短", newsletter: "n" }),
    );
    const notify = vi.fn();
    await expect(generateAllPlatforms(".", undefined, { notify })).rejects.toMatchObject({ platform: "blog" });
    expect(notify).toHaveBeenCalledWith("warn", "AI 沒有整理出文章（原話不足）", expect.stringContaining("blog"));
  });

  it("prompt 寫明原話不足時要輸出標記（parser 綁格式標記）", async () => {
    runClaudePrint.mockResolvedValueOnce(allPlatforms(han(100)));
    await generateAllPlatforms("原話", undefined, { notify: vi.fn() });
    expect(runClaudePrint.mock.calls[0][0]).toContain("【無法生成】");
  });
});
