import { describe, expect, it } from "vitest";
import { buildTasteProfile } from "@/lib/taste/profile";
import type { TasteProfile } from "@/lib/taste/types";
import { cardMedia, rankCardsByTaste, type BeforeCard } from "./cards";

function screenCard(id: number, kind: "movie" | "series" = "movie"): BeforeCard {
  return {
    key: `${kind}:${id}`,
    title: `片${id}`,
    posterUrl: null,
    meta: "",
    placeholder: "screen",
    workId: null,
    plan: { type: "tmdb", kind, tmdbId: id },
  };
}

function liveCard(id: string, place: "live" | "exhibition" = "live"): BeforeCard {
  return {
    key: `work:${id}`,
    title: id,
    posterUrl: null,
    meta: "",
    placeholder: place,
    workId: id,
    plan: { type: "live", place, name: id, venue: "", dates: "", custom: "" },
  };
}

function podcastCard(id: number): BeforeCard {
  return { key: `podcast:${id}`, title: `節目${id}`, posterUrl: null, meta: "", placeholder: "podcast", workId: null, plan: { type: "podcast", itunesId: id, feedUrl: "https://f", show: "s" } };
}

function musicCard(id: number): BeforeCard {
  return {
    key: `music:${id}`,
    title: `專輯${id}`,
    posterUrl: null,
    meta: "",
    placeholder: "music",
    workId: null,
    plan: { type: "music", itunesId: id, title: `專輯${id}` },
  };
}

const empty = { journals: [], publishedWorks: [], marks: [], questionnaire: null };

function liveLover(): TasteProfile {
  return buildTasteProfile({
    ...empty,
    journals: ["a", "b", "c"].map((id) => ({ workId: id, kind: "live" as const, venue: "live" as const })),
  });
}

describe("cardMedia", () => {
  it("電影／影集看 tmdb kind，場外看 place", () => {
    expect(cardMedia(screenCard(1))).toBe("movie");
    expect(cardMedia(screenCard(2, "series"))).toBe("series");
    expect(cardMedia(liveCard("x", "exhibition"))).toBe("exhibition");
  });
});

describe("rankCardsByTaste", () => {
  const cards = [screenCard(1), liveCard("l1"), screenCard(2), screenCard(3, "series"), liveCard("l2"), screenCard(4), liveCard("l3")];

  it("沒有品味訊號：原樣（保留輪流排）", () => {
    expect(rankCardsByTaste(cards, buildTasteProfile(empty))).toEqual(cards);
    expect(rankCardsByTaste(cards, null)).toEqual(cards);
  });

  it("偏演出：演出在前，同分維持原順序", () => {
    const ranked = rankCardsByTaste(cards, liveLover());
    expect(ranked.slice(0, 3).map((card) => card.key)).toEqual(["work:l1", "work:l2", "work:l3"]);
    expect(ranked).toHaveLength(cards.length);
  });

  it("保底：前 4 張至少兩種", () => {
    const lots = [liveCard("l1"), liveCard("l2"), liveCard("l3"), liveCard("l4"), liveCard("l5"), screenCard(1)];
    const ranked = rankCardsByTaste(lots, liveLover());
    const kinds = new Set(ranked.slice(0, 4).map(cardMedia));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(ranked[3].key).toBe("movie:1");
    expect(ranked.map((card) => card.key).sort()).toEqual(lots.map((card) => card.key).sort());
  });

  it("全部同一種就沒得保底", () => {
    const only = [liveCard("l1"), liveCard("l2")];
    expect(rankCardsByTaste(only, liveLover())).toEqual(only);
  });

  it("問卷說在家：影集往前", () => {
    const home = buildTasteProfile({ ...empty, questionnaire: { media: [], setting: "home" } });
    expect(rankCardsByTaste(cards, home)[0].key).toBe("series:3");
  });
});

describe("rankCardsByTaste：前 8 張至少三種", () => {
  it("偏演出的人：前 8 張仍至少有三種", () => {
    const lots = [
      ...Array.from({ length: 9 }, (_, index) => liveCard(`l${index}`)),
      screenCard(1),
      screenCard(2),
      podcastCard(1),
    ];
    const ranked = rankCardsByTaste(lots, liveLover());
    expect(new Set(ranked.slice(0, 8).map(cardMedia)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(ranked.slice(0, 4).map(cardMedia)).size).toBeGreaterThanOrEqual(2);
    expect(ranked.map((card) => card.key).sort()).toEqual(lots.map((card) => card.key).sort());
  });

  it("沒有品味訊號也保底", () => {
    const flat = [...Array.from({ length: 9 }, (_, index) => screenCard(index + 1)), screenCard(20, "series"), podcastCard(1)];
    const ranked = rankCardsByTaste(flat, null);
    expect(new Set(ranked.slice(0, 8).map(cardMedia))).toEqual(new Set(["movie", "series", "podcast"]));
  });

  it("Podcast 算在家", () => {
    expect(cardMedia(podcastCard(1))).toBe("podcast");
    const home = buildTasteProfile({ ...empty, questionnaire: { media: [], setting: "home" } });
    expect(rankCardsByTaste([screenCard(1), liveCard("l1"), podcastCard(1)], home)[0].key).toBe("podcast:1");
  });
});

describe("rankCardsByTaste：音樂", () => {
  it("勾音樂的人：音樂卡往前；只勾 Podcast 的人不會把音樂拉上來", () => {
    expect(cardMedia(musicCard(1))).toBe("music");
    const cards = [screenCard(1), podcastCard(1), musicCard(1)];
    const musicLover = buildTasteProfile({ ...empty, questionnaire: { media: ["music"], setting: null } });
    expect(rankCardsByTaste(cards, musicLover)[0].key).toBe("music:1");
    const podcastLover = buildTasteProfile({ ...empty, questionnaire: { media: ["podcast"], setting: null } });
    expect(rankCardsByTaste(cards, podcastLover)[0].key).toBe("podcast:1");
  });
});

describe("rankCardsByTaste：⑤演出想看哪種（Q-63）", () => {
  function subCard(id: string, subcategory?: "concert" | "theatre" | "dance"): BeforeCard {
    return { ...liveCard(id), key: `event:${id}`, ...(subcategory ? { subcategory } : {}) };
  }

  const cards = [screenCard(1), subCard("劇1", "theatre"), screenCard(2), subCard("舞1", "dance"), subCard("唱1", "concert"), subCard("一般")];

  it("選了的細類排在其他演出前面；其他順序不變", () => {
    const profile = buildTasteProfile({ ...empty, questionnaire: { media: ["movie", "live"], setting: null }, liveKinds: ["dance", "concert"] });
    const order = rankCardsByTaste(cards, profile).map((card) => card.title);
    expect(order.indexOf("舞1")).toBeLessThan(order.indexOf("劇1"));
    expect(order.indexOf("唱1")).toBeLessThan(order.indexOf("劇1"));
    expect(order.indexOf("唱1")).toBeLessThan(order.indexOf("一般"));
    expect(order.indexOf("舞1")).toBeLessThan(order.indexOf("唱1"));
  });

  it("沒選細類：跟以前一樣", () => {
    const plain = buildTasteProfile({ ...empty, questionnaire: { media: ["movie", "live"], setting: null } });
    expect(rankCardsByTaste(cards, plain).map((card) => card.key)).toEqual(cards.map((card) => card.key));
  });

  it("只答了⑤沒別的訊號：照樣把選的細類往前", () => {
    const profile = buildTasteProfile({ ...empty, liveKinds: ["concert"] });
    expect(profile.hasSignal).toBe(false);
    const order = rankCardsByTaste(cards, profile).map((card) => card.title);
    expect(order.indexOf("唱1")).toBeLessThan(order.indexOf("劇1"));
  });

  it("偏好不蓋過媒介分佈：很偏電影的人，電影仍在選的演出前面", () => {
    const profile = buildTasteProfile({
      ...empty,
      journals: ["a", "b", "c", "d"].map((id) => ({ workId: id, kind: "movie" as const, venue: "cinema" as const })),
      liveKinds: ["concert"],
    });
    const order = rankCardsByTaste(cards, profile).map((card) => card.title);
    expect(order.indexOf("片1")).toBeLessThan(order.indexOf("唱1"));
  });
});

