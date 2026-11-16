import { describe, expect, it } from "vitest";
import { WORK_SLUG_PATTERN } from "@/lib/works/format";
import { fnv1a, manualSlug, podcastSlug, tmdbSlug } from "./slug";

describe("fnv1a", () => {
  it("同輸入同輸出、8 碼 hex", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
  });
  it("非 ASCII 也能雜湊", () => {
    expect(fnv1a("股癌 EP703")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("tmdbSlug", () => {
  it("kind + tmdb id，符合 works_slug_format", () => {
    expect(tmdbSlug("movie", 331482)).toBe("movie-331482");
    expect(tmdbSlug("series", 65332)).toBe("series-65332");
    expect(WORK_SLUG_PATTERN.test(tmdbSlug("movie", 1))).toBe(true);
  });
});

describe("podcastSlug", () => {
  it("feed 雜湊 + guid 雜湊，穩定且合法", () => {
    const slug = podcastSlug("https://feeds.example.com/show.xml", "guid-123");
    expect(slug).toBe(podcastSlug("https://feeds.example.com/show.xml", "guid-123"));
    expect(slug).toMatch(/^pod-[0-9a-f]{8}-[0-9a-f]{8}$/);
    expect(WORK_SLUG_PATTERN.test(slug)).toBe(true);
  });
  it("不同集不同 slug", () => {
    expect(podcastSlug("https://a", "1")).not.toBe(podcastSlug("https://a", "2"));
  });
});

describe("manualSlug", () => {
  it("帶 kind、標題雜湊與 nonce，合法且 ≤ 64 字", () => {
    const slug = manualSlug("movie", "夜車上的海", 1700000000000);
    expect(slug).toBe("manual-movie-" + fnv1a("夜車上的海") + "-" + (1700000000000).toString(36));
    expect(WORK_SLUG_PATTERN.test(slug)).toBe(true);
    expect(slug.length).toBeLessThanOrEqual(64);
  });
  it("podcast_episode 的底線轉連字號", () => {
    const slug = manualSlug("podcast_episode", "x", 1);
    expect(slug.startsWith("manual-podcast-episode-")).toBe(true);
    expect(WORK_SLUG_PATTERN.test(slug)).toBe(true);
  });
});
