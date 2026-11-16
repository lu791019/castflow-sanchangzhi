import { describe, expect, it } from "vitest";
import { buildExportMarkdown, exportCountLabel, exportFileName } from "./export";

const NOW = new Date("2026-10-10T14:00:00Z");

describe("buildExportMarkdown", () => {
  it("每篇有標題、狀態、作品、正文與原文", () => {
    const markdown = buildExportMarkdown(
      "林小晴",
      [
        {
          title: "看完《海街日記》",
          createdAt: "2026-10-07T14:00:00Z",
          publishedAt: "2026-10-08T01:00:00Z",
          visibility: "unlisted",
          workTitle: "海街日記",
          body: "正文\n",
          transcript: "嗯……燈亮的時候",
        },
        {
          title: "草稿一篇",
          createdAt: "2026-10-09T14:00:00Z",
          publishedAt: null,
          visibility: "public",
          workTitle: null,
          body: "草稿正文",
          transcript: null,
        },
      ],
      NOW,
    );
    expect(markdown).toContain("# 林小晴 的專欄・散場之後");
    expect(markdown).toContain("共 2 篇");
    expect(markdown).toContain("- 狀態：2026.10.08 發佈・只給有連結的人");
    expect(markdown).toContain("- 作品：《海街日記》");
    expect(markdown).toContain("### 當時說的原文\n\n嗯……燈亮的時候");
    expect(markdown).toContain("- 狀態：草稿");
    expect(markdown.match(/### 當時說的原文/g)).toHaveLength(1);
  });
});

describe("檔名與說明", () => {
  it("檔名用台北日期", () => {
    expect(exportFileName(new Date("2026-10-10T17:00:00Z"))).toBe("castflow-20261011.md");
  });

  it("篇數說明", () => {
    expect(exportCountLabel(12)).toBe("12 篇文章與當時說的原文，打包成一個檔案");
    expect(exportCountLabel(0)).toBe("還沒有文章；說過一段之後就能匯出");
  });
});
