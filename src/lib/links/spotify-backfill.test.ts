import { describe, expect, it } from "vitest";
import { BACKFILL_DEFAULT_LIMIT, describePlan, parseBackfillArgs, selectBackfillTargets, type BackfillWorkRow } from "./spotify-backfill";

function work(id: string, extra: Partial<BackfillWorkRow> = {}): BackfillWorkRow {
  return { id, kind: "music", slug: `music-${id}`, title: `專輯${id}`, credit: "告五人", podcast_show: null, feed_url: null, ...extra };
}

describe("parseBackfillArgs", () => {
  it("預設乾跑、20 組、全部類別", () => {
    expect(parseBackfillArgs([])).toEqual({ ok: true, value: { write: false, limit: BACKFILL_DEFAULT_LIMIT, kind: "all" } });
  });

  it("--write、--limit、--kind podcast", () => {
    expect(parseBackfillArgs(["--write", "--limit", "50", "--kind", "podcast"])).toEqual({
      ok: true,
      value: { write: true, limit: 50, kind: "podcast_episode" },
    });
  });

  it("不合法的參數回錯", () => {
    expect(parseBackfillArgs(["--limit", "0"]).ok).toBe(false);
    expect(parseBackfillArgs(["--limit", "abc"]).ok).toBe(false);
    expect(parseBackfillArgs(["--kind", "movie"]).ok).toBe(false);
    expect(parseBackfillArgs(["--dry"]).ok).toBe(false);
  });
});

describe("selectBackfillTargets", () => {
  it("跳過已有 Spotify 連結與非音樂／Podcast 的作品", () => {
    const targets = selectBackfillTargets([work("a"), work("b"), work("m", { kind: "movie" })], new Set(["b"]), { kind: "all", limit: 20 });
    expect(targets.map((target) => target.workIds)).toEqual([["a"]]);
  });

  it("Podcast 同 feed 併成一組，只搜一次", () => {
    const feed = "https://feeds.example.com/a.xml";
    const pod = (id: string) => work(id, { kind: "podcast_episode", podcast_show: "節目", feed_url: feed });
    const targets = selectBackfillTargets([pod("p1"), work("a"), pod("p2")], new Set(), { kind: "all", limit: 20 });
    expect(targets.map((target) => target.workIds)).toEqual([["p1", "p2"], ["a"]]);
  });

  it("limit 是組數；已滿後同節目的集數仍併進既有組", () => {
    const feed = "https://feeds.example.com/a.xml";
    const pod = (id: string) => work(id, { kind: "podcast_episode", podcast_show: "節目", feed_url: feed });
    const targets = selectBackfillTargets([pod("p1"), work("a"), work("b"), pod("p2")], new Set(), { kind: "all", limit: 2 });
    expect(targets.map((target) => target.workIds)).toEqual([["p1", "p2"], ["a"]]);
  });

  it("--kind music 只挑音樂", () => {
    const targets = selectBackfillTargets(
      [work("a"), work("p", { kind: "podcast_episode", podcast_show: "x", feed_url: "f" })],
      new Set(),
      { kind: "music", limit: 20 },
    );
    expect(targets.map((target) => target.work.id)).toEqual(["a"]);
  });
});

describe("describePlan", () => {
  it("一行看得出配到哪、沒把握、失敗", () => {
    const [target] = selectBackfillTargets([work("a")], new Set(), { kind: "all", limit: 1 });
    expect(describePlan(target, { status: "match", url: "https://open.spotify.com/album/x", via: "search", name: "專輯a — 告五人" })).toContain(
      "https://open.spotify.com/album/x",
    );
    expect(describePlan(target, { status: "no_match", candidates: 3 })).toContain("沒把握");
    expect(describePlan(target, { status: "failed", error: "HTTP 429" })).toContain("HTTP 429");
  });
});
