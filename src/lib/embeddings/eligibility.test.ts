import { describe, expect, it } from "vitest";
import { isEmbeddable, type EmbeddableFields } from "./eligibility";

const base: EmbeddableFields = {
  visibility: "public",
  byline: "pen_name",
  published_at: "2026-10-12T12:00:00Z",
  share_slug: "abc123",
  source: "upload",
};

describe("isEmbeddable：只算以筆名署名＋公開發佈的文章", () => {
  it("公開筆名已發佈 → 算", () => {
    expect(isEmbeddable(base)).toBe(true);
  });

  it.each([
    ["不公開", { visibility: "private" }],
    ["只給有連結的人", { visibility: "unlisted" }],
    ["匿名署名", { byline: "anonymous" }],
    ["未發佈", { published_at: null }],
    ["沒有分享網址", { share_slug: null }],
    ["RSS 原始集數", { source: "rss" }],
  ])("%s → 不算", (_label, patch) => {
    expect(isEmbeddable({ ...base, ...patch })).toBe(false);
  });
});
