import { describe, expect, it } from "vitest";
import { buildAuthorStats } from "./profile";

describe("buildAuthorStats", () => {
  it("只數有 blog 的集、草稿為其餘集數", () => {
    const stats = buildAuthorStats([
      { source: "text", created_at: "2026-08-30T00:00:00Z", hasBlog: true },
      { source: "text", created_at: "2026-09-14T00:00:00Z", hasBlog: true },
      { source: "rss", created_at: "2026-09-28T00:00:00Z", hasBlog: true },
      { source: "audio", created_at: "2026-10-01T00:00:00Z", hasBlog: false },
    ]);
    expect(stats.publishedCount).toBe(3);
    expect(stats.draftCount).toBe(1);
    expect(stats.sinceMonth).toBe("2026.08");
    expect(stats.mostWritten).toBe("影劇");
  });

  it("沒有發表過時給空狀態值", () => {
    const stats = buildAuthorStats([
      { source: "audio", created_at: "2026-10-01T00:00:00Z", hasBlog: false },
    ]);
    expect(stats.publishedCount).toBe(0);
    expect(stats.draftCount).toBe(1);
    expect(stats.sinceMonth).toBeNull();
    expect(stats.mostWritten).toBe("—");
  });
});
