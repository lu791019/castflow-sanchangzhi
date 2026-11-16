import { describe, expect, it } from "vitest";
import { NEUTRAL_DESCRIPTION, shareMetadata, siteMetadataBase, withdrawnMetadata } from "./share-metadata";

describe("siteMetadataBase", () => {
  it("合法網址回 URL；空白或錯誤格式回 undefined", () => {
    expect(siteMetadataBase("https://castflow.app")?.origin).toBe("https://castflow.app");
    expect(siteMetadataBase("")).toBeUndefined();
    expect(siteMetadataBase("not a url")).toBeUndefined();
  });
});

describe("shareMetadata", () => {
  it("og 為 article、帶標題描述與網址；twitter 用大圖卡", () => {
    const meta = shareMetadata({ slug: "abc", title: "看完《海街日記》", description: "一部電影" });
    expect(meta.title).toBe("看完《海街日記》｜散場誌");
    expect(meta.openGraph).toMatchObject({ type: "article", title: "看完《海街日記》", description: "一部電影", url: "/s/abc", locale: "zh_TW" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "看完《海街日記》" });
  });
});

describe("withdrawnMetadata", () => {
  it("不帶文章內容、不收錄；描述用中性標語", () => {
    const meta = withdrawnMetadata();
    expect(meta.robots).toEqual({ index: false });
    expect(meta.description).toBe(NEUTRAL_DESCRIPTION);
    expect(meta.openGraph).toMatchObject({ title: "這一篇已經收回了", description: NEUTRAL_DESCRIPTION });
  });
});
