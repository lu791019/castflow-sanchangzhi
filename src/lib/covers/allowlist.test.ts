import { describe, expect, it } from "vitest";
import { COVER_SOURCE_DOMAINS, decideCoverStatus, isAllowlistedCoverHost } from "./allowlist";

describe("isAllowlistedCoverHost", () => {
  it("白名單網域與其子網域都算", () => {
    expect(isAllowlistedCoverHost("image.tmdb.org")).toBe(true);
    expect(isAllowlistedCoverHost("is1-ssl.mzstatic.com")).toBe(true);
    expect(isAllowlistedCoverHost("upload.wikimedia.org")).toBe(true);
    expect(isAllowlistedCoverHost("KKTIX.COM")).toBe(true);
  });

  it("只是字尾相同、但不是子網域的不算", () => {
    expect(isAllowlistedCoverHost("eviltmdb.org")).toBe(false);
    expect(isAllowlistedCoverHost("tmdb.org.evil.com")).toBe(false);
    expect(isAllowlistedCoverHost("example.com")).toBe(false);
    expect(isAllowlistedCoverHost("")).toBe(false);
  });

  it("先放至少 10 個常見來源", () => {
    expect(COVER_SOURCE_DOMAINS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("decideCoverStatus", () => {
  it("上傳一律待審（內容無法自動判斷）", () => {
    expect(decideCoverStatus({ source: "upload", hosts: [] })).toBe("pending");
  });

  it("貼網址：原址與每一跳都在白名單 → 直接通過", () => {
    expect(decideCoverStatus({ source: "url", hosts: ["image.tmdb.org"] })).toBe("approved");
    expect(decideCoverStatus({ source: "url", hosts: ["www.kktix.com", "assets.kktix.io"] })).toBe("approved");
  });

  it("貼網址：任何一跳在白名單外 → 待審", () => {
    expect(decideCoverStatus({ source: "url", hosts: ["example.com"] })).toBe("pending");
    expect(decideCoverStatus({ source: "url", hosts: ["image.tmdb.org", "example.com"] })).toBe("pending");
    expect(decideCoverStatus({ source: "url", hosts: [] })).toBe("pending");
  });
});
