import { describe, expect, it } from "vitest";
import { buildTasteProfile, BEHAVIOR_THRESHOLD, mediaOfWorkKind } from "./profile";

const empty = { journals: [], publishedWorks: [], marks: [], questionnaire: null };

describe("mediaOfWorkKind", () => {
  it("podcast 單集歸 podcast", () => {
    expect(mediaOfWorkKind("podcast_episode")).toBe("podcast");
    expect(mediaOfWorkKind("live")).toBe("live");
  });

  it("音樂歸 music，不再併入 podcast", () => {
    expect(mediaOfWorkKind("music")).toBe("music");
  });
});

describe("buildTasteProfile：音樂", () => {
  it("音樂日誌與文章算進 music，podcast 不受影響", () => {
    const profile = buildTasteProfile({
      ...empty,
      journals: [
        { workId: "m1", kind: "music", venue: "home" },
        { workId: "m2", kind: "music", venue: "commute" },
        { workId: "p1", kind: "podcast_episode", venue: "commute" },
      ],
      publishedWorks: [{ workId: "m1", kind: "music" }],
    });
    expect(profile.media.music).toBeCloseTo(0.75);
    expect(profile.media.podcast).toBeCloseTo(0.25);
  });

  it("問卷勾音樂、挑的作品是音樂：冷啟動時補進 music", () => {
    const profile = buildTasteProfile({
      ...empty,
      questionnaire: { media: ["music"], setting: null },
      picks: [{ workId: "m1", kind: "music", seen: true }],
    });
    expect(profile.usedQuestionnaire).toBe(true);
    expect(profile.media.music).toBe(1);
    expect(profile.media.podcast).toBe(0);
  });

  it("舊問卷沒有 music：照常運作，music 為 0", () => {
    const profile = buildTasteProfile({ ...empty, questionnaire: { media: ["movie", "podcast"], setting: "home" } });
    expect(profile.hasSignal).toBe(true);
    expect(profile.media.music).toBe(0);
    expect(profile.media.movie).toBeCloseTo(0.5);
  });
});

describe("buildTasteProfile", () => {
  it("什麼都沒有：分佈全 0、沒有訊號", () => {
    const profile = buildTasteProfile(empty);
    expect(profile.hasSignal).toBe(false);
    expect(profile.media.movie).toBe(0);
    expect(profile.works).toEqual([]);
  });

  it("行為為主：日誌＋公開文章的作品 kind 組媒介分佈，作品集合去重", () => {
    const profile = buildTasteProfile({
      ...empty,
      journals: [
        { workId: "a", kind: "live", venue: "live" },
        { workId: "b", kind: "live", venue: "live" },
        { workId: "c", kind: "movie", venue: "cinema" },
      ],
      publishedWorks: [{ workId: "a", kind: "live" }],
    });
    expect(profile.behaviorCount).toBe(4);
    expect(profile.media.live).toBeCloseTo(0.75);
    expect(profile.media.movie).toBeCloseTo(0.25);
    expect(profile.works).toEqual(["a", "b", "c"]);
    expect(profile.setting.out).toBeCloseTo(1);
    expect(profile.usedQuestionnaire).toBe(false);
  });

  it("沒有作品的日誌（手寫片名）不進媒介分佈，但場域照算", () => {
    const profile = buildTasteProfile({ ...empty, journals: [{ workId: null, kind: null, venue: "home" }] });
    expect(profile.media.movie).toBe(0);
    expect(profile.setting.home).toBe(1);
  });

  it(`行為 <${BEHAVIOR_THRESHOLD} 筆才用問卷補權`, () => {
    const questionnaire = { media: ["exhibition" as const], setting: "out" as const };
    const cold = buildTasteProfile({ ...empty, questionnaire, journals: [{ workId: "a", kind: "movie", venue: "home" }] });
    expect(cold.usedQuestionnaire).toBe(true);
    expect(cold.media.exhibition).toBeGreaterThan(0);
    expect(cold.setting.out).toBeGreaterThan(0);

    const warm = buildTasteProfile({
      ...empty,
      questionnaire,
      journals: ["a", "b", "c"].map((id) => ({ workId: id, kind: "movie" as const, venue: "cinema" as const })),
    });
    expect(warm.usedQuestionnaire).toBe(false);
    expect(warm.media.exhibition).toBe(0);
  });

  it("問卷 both 平分在家與出門", () => {
    const profile = buildTasteProfile({ ...empty, questionnaire: { media: [], setting: "both" } });
    expect(profile.setting.home).toBeCloseTo(0.5);
    expect(profile.setting.out).toBeCloseTo(0.5);
    expect(profile.hasSignal).toBe(true);
  });

  it("畫記句集合以 episode:hash 去重", () => {
    const profile = buildTasteProfile({
      ...empty,
      marks: [
        { episodeId: "e1", passageHash: "aaaa" },
        { episodeId: "e1", passageHash: "aaaa" },
        { episodeId: "e2", passageHash: "bbbb" },
      ],
    });
    expect(profile.passages).toEqual(["e1:aaaa", "e2:bbbb"]);
  });

  it("問卷第三題挑的作品（不寫日誌，UX-15）：進作品集合；行為少時 kind 補進媒介分佈", () => {
    const picks = [
      { workId: "p1", kind: "series" as const, seen: true },
      { workId: "a", kind: "movie" as const, seen: false },
    ];
    const cold = buildTasteProfile({ ...empty, picks, journals: [{ workId: "a", kind: "movie", venue: "home" }] });
    expect(cold.works).toEqual(["a", "p1"]);
    expect(cold.media.series).toBeGreaterThan(0);
    expect(cold.usedQuestionnaire).toBe(true);
    expect(cold.behaviorCount).toBe(1);

    const warm = buildTasteProfile({
      ...empty,
      picks,
      journals: ["a", "b", "c"].map((id) => ({ workId: id, kind: "movie" as const, venue: "cinema" as const })),
    });
    expect(warm.works).toContain("p1");
    expect(warm.media.series).toBe(0);
  });

  it("⑤演出想看哪種（Q-63）：不管行為多少都照帶，給散場之前排演出；沒答是空陣列", () => {
    const liveKinds = ["concert" as const, "festival" as const];
    expect(buildTasteProfile({ ...empty, liveKinds }).liveKinds).toEqual(["concert", "festival"]);
    const warm = buildTasteProfile({
      ...empty,
      liveKinds,
      journals: ["a", "b", "c"].map((id) => ({ workId: id, kind: "movie" as const, venue: "cinema" as const })),
    });
    expect(warm.liveKinds).toEqual(["concert", "festival"]);
    expect(buildTasteProfile(empty).liveKinds).toEqual([]);
  });
});
