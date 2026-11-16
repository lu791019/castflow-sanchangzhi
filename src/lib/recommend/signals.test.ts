import { describe, expect, it } from "vitest";
import type { TasteProfile } from "@/lib/taste/types";
import { buildSignals, hasEnoughSignal } from "./signals";

const tasteWith = (hasSignal: boolean): TasteProfile => ({
  media: { movie: 0, series: 0, podcast: 0, music: 0, live: hasSignal ? 1 : 0, exhibition: 0 },
  setting: { home: 0, out: hasSignal ? 1 : 0 },
  works: [],
  passages: [],
  behaviorCount: 0,
  usedQuestionnaire: hasSignal,
  hasSignal,
  liveKinds: [],
});

describe("buildSignals", () => {
  it("寫過的優先當種子，其次記過、排了；同一部只算一次；沒有 TMDB id 的不當種子但照樣排除", () => {
    const signals = buildSignals({
      written: [
        { workId: "w1", title: "人聲", kind: "movie", tmdbId: 1 },
        { workId: "w1", title: "人聲", kind: "movie", tmdbId: 1 },
      ],
      journals: [
        { workId: "w1", title: "人聲", kind: "movie", tmdbId: 1, status: "recorded" },
        { workId: "w2", title: "師父", kind: "movie", tmdbId: 2, status: "recorded" },
        { workId: "w3", title: "某影集", kind: "series", tmdbId: 3, status: "planned" },
        { workId: "w4", title: "某演出", kind: "live", tmdbId: null, status: "planned" },
        { workId: "w5", title: "跳過的", kind: "movie", tmdbId: 5, status: "skipped" },
        { workId: "w6", title: "說過一段", kind: "movie", tmdbId: 6, status: "said" },
      ],
      taste: null,
    });
    expect(signals.seeds.map((seed) => [seed.title, seed.source])).toEqual([
      ["人聲", "wrote"],
      ["師父", "logged"],
      ["某影集", "planned"],
      ["說過一段", "logged"],
    ]);
    expect([...signals.exclusions.screenKeys].sort()).toEqual(["movie:1", "movie:2", "movie:5", "movie:6", "series:3"]);
    expect([...signals.exclusions.workIds].sort()).toEqual(["w1", "w2", "w3", "w4", "w5", "w6"]);
  });

  it("種子最多 MAX_SEEDS 部", () => {
    const written = Array.from({ length: 12 }, (_, index) => ({ workId: `w${index}`, title: `作品${index}`, kind: "movie" as const, tmdbId: index + 1 }));
    expect(buildSignals({ written, journals: [], taste: null }).seeds).toHaveLength(8);
  });
});

describe("hasEnoughSignal", () => {
  it("新用戶（沒寫過、沒記過、沒填問卷）不夠", () => {
    expect(hasEnoughSignal(buildSignals({ written: [], journals: [], taste: tasteWith(false) }))).toBe(false);
    expect(hasEnoughSignal(buildSignals({ written: [], journals: [], taste: null }))).toBe(false);
  });

  it("有種子或有品味資料就夠", () => {
    expect(hasEnoughSignal(buildSignals({ written: [], journals: [], taste: tasteWith(true) }))).toBe(true);
    expect(
      hasEnoughSignal(buildSignals({ written: [{ workId: "w1", title: "人聲", kind: "movie", tmdbId: 1 }], journals: [], taste: null })),
    ).toBe(true);
  });
});
