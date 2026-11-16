import { describe, expect, it } from "vitest";
import { buildShelves, shelfOfKind, type CatalogWork } from "./shelves";

function work(partial: Partial<CatalogWork> & Pick<CatalogWork, "id" | "kind" | "title">): CatalogWork {
  return {
    slug: partial.id,
    year: null,
    podcastShow: null,
    posterUrl: null,
    eventDate: null,
    issueNo: 1,
    ...partial,
  };
}

const feel = (workId: string, publishedAt: string) => ({ workId, publishedAt });

describe("shelfOfKind", () => {
  it("live 與 performance 都歸演出", () => {
    expect(shelfOfKind("live")).toBe("performance");
    expect(shelfOfKind("performance")).toBe("performance");
    expect(shelfOfKind("podcast_episode")).toBe("podcast");
    expect(shelfOfKind("weird")).toBeNull();
  });
});

describe("buildShelves（index.shelf：依類型分段、作品依最近一段排序、不排名）", () => {
  const works = [
    work({ id: "m1", kind: "movie", title: "海街日記", year: 2015 }),
    work({ id: "m2", kind: "movie", title: "一一" }),
    work({ id: "m3", kind: "movie", title: "沒人說過" }),
    work({ id: "s1", kind: "series", title: "請回答1988" }),
    work({ id: "p1", kind: "podcast_episode", title: "第 42 集", podcastShow: "夜貓" }),
    work({ id: "p2", kind: "podcast_episode", title: "第 41 集", podcastShow: "夜貓" }),
    work({ id: "l1", kind: "live", title: "島嶼夜歌・草地音樂會", eventDate: "2026-10-09" }),
  ];
  const feelings = [
    feel("m1", "2026-10-01T00:00:00Z"),
    feel("m1", "2026-10-08T00:00:00Z"),
    feel("m2", "2026-10-09T00:00:00Z"),
    feel("s1", "2026-10-02T00:00:00Z"),
    feel("p1", "2026-10-03T00:00:00Z"),
    feel("p2", "2026-10-05T00:00:00Z"),
    feel("p2", "2026-10-06T00:00:00Z"),
    feel("l1", "2026-10-09T12:00:00Z"),
  ];
  const shelves = buildShelves(works, feelings);

  it("段的順序固定；沒有作品的類型（展覽）不出現", () => {
    expect(shelves.map((shelf) => shelf.label)).toEqual(["電影", "影集", "Podcast", "演出"]);
  });
  it("段首計數與量詞；沒人說過的作品不收", () => {
    expect(shelves.map((shelf) => shelf.countLabel)).toEqual(["2 部", "1 部", "1 個節目", "1 場"]);
  });
  it("段內依最近一段由新到舊；統計欄用阿拉伯數字", () => {
    const movies = shelves[0];
    expect(movies.items.map((item) => item.title)).toEqual(["一一", "海街日記"]);
    expect(movies.items[1]).toMatchObject({ countLabel: "2 段", href: "/works/m1", coverKind: "movie" });
  });
  it("Podcast 以節目為單位合併段數，連到索引搜尋該節目", () => {
    const podcast = shelves[2];
    expect(podcast.items).toHaveLength(1);
    expect(podcast.items[0]).toMatchObject({
      title: "夜貓",
      plate: "夜貓",
      countLabel: "3 段",
      coverKind: "podcast",
      href: `/catalog?q=${encodeURIComponent("夜貓")}`,
    });
  });
  it("演出：字卡取「・」前的短名，記號是「10 月 9 日」", () => {
    expect(shelves[3].items[0]).toMatchObject({ plate: "島嶼夜歌", mark: "10 月 9 日", coverKind: "live" });
  });
  it("每段上限：超過就截斷並標示 total", () => {
    const many = Array.from({ length: 5 }, (_, i) => work({ id: `x${i}`, kind: "movie", title: `片${i}` }));
    const limited = buildShelves(many, many.map((w, i) => feel(w.id, `2026-10-0${i + 1}T00:00:00Z`)), { perShelf: 3 });
    expect(limited[0].items).toHaveLength(3);
    expect(limited[0].total).toBe(5);
    expect(limited[0].countLabel).toBe("5 部");
  });
  it("有海報網址用海報、沒有用斜線紋", () => {
    const withPoster = buildShelves([work({ id: "a", kind: "movie", title: "甲", posterUrl: "https://image.tmdb.org/a.jpg" })], [feel("a", "2026-10-01T00:00:00Z")]);
    expect(withPoster[0].items[0].posterUrl).toBe("https://image.tmdb.org/a.jpg");
  });
  it("封面補齊：演出有封面也放圖；Podcast 節目格取任一集的節目封面", () => {
    const live = buildShelves(
      [work({ id: "l", kind: "live", title: "島嶼夜歌", posterUrl: "https://covers/l.jpg" })],
      [feel("l", "2026-10-01T00:00:00Z")],
    );
    expect(live[0].items[0]).toMatchObject({ coverKind: "live", posterUrl: "https://covers/l.jpg", plate: "島嶼夜歌" });
    const pods = buildShelves(
      [
        work({ id: "p1", kind: "podcast_episode", title: "EP1", podcastShow: "夜貓", posterUrl: null }),
        work({ id: "p2", kind: "podcast_episode", title: "EP2", podcastShow: "夜貓", posterUrl: "https://is1/600.jpg" }),
      ],
      [feel("p1", "2026-10-01T00:00:00Z"), feel("p2", "2026-10-02T00:00:00Z")],
    );
    expect(pods[0].items[0].posterUrl).toBe("https://is1/600.jpg");
  });
});

describe("音樂書架（Q-61）", () => {
  it("music 歸音樂書架、排在 Podcast 之後演出之前；空的不出現", () => {
    expect(shelfOfKind("music")).toBe("music");
    const shelves = buildShelves(
      [
        work({ id: "a1", kind: "music", title: "帶你飛" }),
        work({ id: "m1", kind: "movie", title: "海街日記" }),
        work({ id: "l1", kind: "live", title: "島嶼夜歌" }),
      ],
      [
        { workId: "a1", publishedAt: "2026-10-14T10:00:00Z" },
        { workId: "m1", publishedAt: "2026-10-13T10:00:00Z" },
        { workId: "l1", publishedAt: "2026-10-12T10:00:00Z" },
      ],
    );
    expect(shelves.map((shelf) => [shelf.kind, shelf.label, shelf.countLabel])).toEqual([
      ["movie", "電影", "1 部"],
      ["music", "音樂", "1 張"],
      ["performance", "演出", "1 場"],
    ]);
    expect(shelves[1].items[0]).toMatchObject({ title: "帶你飛", coverKind: "music", href: "/works/a1", plate: "" });
  });
});
