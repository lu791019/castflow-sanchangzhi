import { describe, expect, it } from "vitest";
import type { BeforeCard, CardPlan } from "./cards";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import { availableSubFilters, cityChoices, showsCityFilter, filterTabs, liveEmptyCopy, SUB_FILTER_LABELS, subFilterCards, visibleCards } from "./live-filter";

function card(key: string, plan: CardPlan, subcategory?: LiveSubcategory): BeforeCard {
  return { key, title: key, posterUrl: null, meta: "", placeholder: "live", workId: null, plan, ...(subcategory ? { subcategory } : {}) };
}

const movie = (id: number) => card(`movie:${id}`, { type: "tmdb", kind: "movie", tmdbId: id });
const show = (id: string, subcategory?: LiveSubcategory, place: "live" | "exhibition" = "live") =>
  card(`event:${id}`, { type: "live", place, name: id, venue: "", dates: "", custom: "" }, subcategory);

describe("SUB_FILTER_LABELS", () => {
  it("全部／演唱會／戲劇／舞蹈／音樂祭", () => {
    expect(Object.values(SUB_FILTER_LABELS)).toEqual(["全部", "演唱會", "獨立音樂", "戲劇", "舞蹈", "音樂祭"]);
  });
});

describe("availableSubFilters：只顯示有資料的細類", () => {
  it("照固定順序；有任何細類才出「全部」", () => {
    expect(availableSubFilters([show("a", "festival"), show("b", "concert"), show("c", "festival")])).toEqual(["all", "concert", "festival"]);
    expect(availableSubFilters([show("a", "dance"), show("b", "indie"), show("c", "concert")])).toEqual(["all", "concert", "indie", "dance"]);
  });

  it("沒有任何細類（全是一般演出）→ 不出小標籤", () => {
    expect(availableSubFilters([show("a"), show("b")])).toEqual([]);
  });
});

describe("subFilterCards：小標籤只剩該類，最多 12 張", () => {
  it("只留該類", () => {
    expect(subFilterCards([show("a", "concert"), show("b", "theatre"), show("c", "concert")], "concert").map((item) => item.key)).toEqual([
      "event:a",
      "event:c",
    ]);
  });

  it("上限 12", () => {
    const many = Array.from({ length: 15 }, (_, index) => show(`d${index}`, "dance"));
    expect(subFilterCards(many, "dance")).toHaveLength(12);
  });
});

describe("visibleCards：分頁＋小標籤", () => {
  const cards = [movie(1), show("a", "concert"), show("g")];
  const liveSub = [show("a", "concert"), show("t", "theatre")];

  it("演出＋全部：照原本演出分頁（含一般演出）", () => {
    expect(visibleCards(cards, liveSub, "live", "all").map((item) => item.key)).toEqual(["event:a", "event:g"]);
  });

  it("演出＋戲劇：從細類池子取（總上限外的也看得到）", () => {
    expect(visibleCards(cards, liveSub, "live", "theatre").map((item) => item.key)).toEqual(["event:t"]);
  });

  it("其他分頁不管小標籤", () => {
    expect(visibleCards(cards, liveSub, "movie", "theatre").map((item) => item.key)).toEqual(["movie:1"]);
  });
});

describe("filterTabs：選了縣市時，演出、展覽分頁一定在（才看得到空狀態、換回來）", () => {
  it("沒選縣市 → 照原本（沒卡的類別不出現）", () => {
    expect(filterTabs([movie(1)], null)).toEqual(["all", "movie"]);
  });

  it("選了縣市 → 補演出、展覽，順序照分類列", () => {
    expect(filterTabs([movie(1)], "臺南市")).toEqual(["all", "movie", "live", "exhibition"]);
  });
});

describe("cityChoices：選項＝有活動的縣市；目前選的若已沒活動也留著", () => {
  it("原樣", () => {
    expect(cityChoices(["臺北市", "高雄市"], "高雄市")).toEqual(["臺北市", "高雄市"]);
    expect(cityChoices(["臺北市"], null)).toEqual(["臺北市"]);
  });

  it("選的縣市不在清單 → 放最前面", () => {
    expect(cityChoices(["臺北市"], "澎湖縣")).toEqual(["澎湖縣", "臺北市"]);
  });
});

describe("showsCityFilter：「全部」與演出、展覽分頁顯示縣市選單；電影、影集、Podcast、音樂不顯示", () => {
  it("分頁", () => {
    expect((["all", "live", "exhibition"] as const).map(showsCityFilter)).toEqual([true, true, true]);
    expect((["movie", "series", "podcast", "music"] as const).map(showsCityFilter)).toEqual([false, false, false, false]);
  });
});

describe("liveEmptyCopy", () => {
  it("一句話，不讓整區消失", () => {
    expect(liveEmptyCopy("臺南市", "live")).toBe("這 30 天臺南市沒有演出，換個縣市看看");
    expect(liveEmptyCopy("澎湖縣", "exhibition")).toBe("這 30 天澎湖縣沒有展覽，換個縣市看看");
    expect(liveEmptyCopy("臺南市", "live", "dance")).toBe("這 30 天臺南市沒有舞蹈，換個縣市看看");
  });
});
