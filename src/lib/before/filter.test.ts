import { describe, expect, it } from "vitest";
import type { BeforeCard, CardPlan } from "./cards";
import { ALL_VIEW_LIMIT, BEFORE_FILTERS, availableFilters, filterCards } from "./filter";

function card(key: string, plan: CardPlan): BeforeCard {
  return { key, title: key, posterUrl: null, meta: "", placeholder: "screen", workId: null, plan };
}

const movie = (id: number) => card(`movie:${id}`, { type: "tmdb", kind: "movie", tmdbId: id });
const series = (id: number) => card(`series:${id}`, { type: "tmdb", kind: "series", tmdbId: id });
const podcast = (id: number) => card(`podcast:${id}`, { type: "podcast", itunesId: id, feedUrl: "https://f", show: "s" });
const show = (id: string, place: "live" | "exhibition" = "live") =>
  card(`culture:${id}`, { type: "live", place, name: id, venue: "", dates: "", custom: "" });

describe("BEFORE_FILTERS", () => {
  it("全部／電影／影集／Podcast／音樂／演出／展覽", () => {
    expect(BEFORE_FILTERS.map((filter) => filter.label)).toEqual(["全部", "電影", "影集", "Podcast", "音樂", "演出", "展覽"]);
  });
});

describe("filterCards", () => {
  const cards = [movie(1), show("a"), podcast(1), series(1), show("x", "exhibition"), ...Array.from({ length: 12 }, (_, index) => movie(index + 10))];

  it(`全部：照排好的順序取前 ${ALL_VIEW_LIMIT} 張`, () => {
    const all = filterCards(cards, "all");
    expect(all).toHaveLength(ALL_VIEW_LIMIT);
    expect(all.slice(0, 5).map((item) => item.key)).toEqual(["movie:1", "culture:a", "podcast:1", "series:1", "culture:x"]);
  });

  it("寬版可以要更多張（Q-60，最多 18）；手機預設不變", () => {
    expect(filterCards(cards, "all", 16)).toHaveLength(16);
    expect(filterCards(cards, "all", 18)).toHaveLength(cards.length);
    expect(filterCards(cards, "movie", 2)).toHaveLength(13);
  });

  it("單一類別：該類全部（不設上限），順序不變", () => {
    expect(filterCards(cards, "movie")).toHaveLength(13);
    expect(filterCards(cards, "exhibition").map((item) => item.key)).toEqual(["culture:x"]);
    expect(filterCards(cards, "podcast").map((item) => item.key)).toEqual(["podcast:1"]);
  });
});

describe("availableFilters：沒有卡的類別不出現（全部一定在）", () => {
  it("來源掛掉只少那一類", () => {
    expect(availableFilters([movie(1), series(2)])).toEqual(["all", "movie", "series"]);
    expect(availableFilters([])).toEqual(["all"]);
  });
});
