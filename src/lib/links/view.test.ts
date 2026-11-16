import { describe, expect, it } from "vitest";
import { tellUsKinds } from "./merge";
import { boxWatchInfo } from "./view";
import type { WorkLinksView } from "./types";

const TMDB = "https://www.themoviedb.org/tv/1/watch?locale=TW";

function view(partial: Partial<WorkLinksView>): WorkLinksView {
  return { watch: [], ticket: [], official: [], missing: false, ...partial };
}

describe("boxWatchInfo：資訊框「在哪看」改吃合併後的連結", () => {
  it("有真連結 → 列表態；含 TMDB 來源才標 JustWatch", () => {
    const info = boxWatchInfo(
      view({
        watch: [
          { kind: "watch", source: "netflix", label: "Netflix", url: "https://www.netflix.com/title/1", origin: "curated", note: null },
          { kind: "watch", source: "catchplay", label: "Catchplay", url: TMDB, origin: "tmdb", note: "租借" },
          { kind: "watch", source: "justwatch", label: "JustWatch", url: "https://www.justwatch.com/tw/search?q=x", origin: "search", note: "搜尋" },
        ],
      }),
      { status: "none", platforms: [], attribution: null },
    );
    expect(info).toEqual({
      status: "available",
      platforms: [
        { name: "Netflix", note: "直連", url: "https://www.netflix.com/title/1" },
        { name: "Catchplay", note: "租借", url: TMDB },
      ],
      attribution: "資料來源：JustWatch / TMDB",
    });
  });

  it("只有 curated／使用者補的 → 不標 JustWatch", () => {
    const info = boxWatchInfo(
      view({ watch: [{ kind: "watch", source: "netflix", label: "Netflix", url: "https://www.netflix.com/title/1", origin: "user", note: null }] }),
      null,
    );
    expect(info?.attribution).toBeNull();
    expect(info?.platforms[0].note).toBe("讀者補充");
  });

  it("沒真連結 → 原本的狀態（院線／無資料）照舊", () => {
    const theaters = { status: "in_theaters" as const, platforms: [], attribution: null, since: "2026-10-01" };
    expect(boxWatchInfo(view({ missing: true }), theaters)).toBe(theaters);
    expect(boxWatchInfo(view({ missing: true }), null)).toBeNull();
  });
});

describe("tellUsKinds：補資料表單可選的種類", () => {
  it("影劇在哪看、演出展覽買票與官網", () => {
    expect(tellUsKinds("movie")).toEqual(["watch", "ticket"]);
    expect(tellUsKinds("series")).toEqual(["watch"]);
    expect(tellUsKinds("live")).toEqual(["ticket", "official"]);
    expect(tellUsKinds("exhibition")).toEqual(["official", "ticket"]);
    expect(tellUsKinds("podcast_episode")).toEqual([]);
  });
});
