import { describe, expect, it } from "vitest";
import { episodeTimeLabel, journalBylineLabel, toEpisodeJournal } from "./episode-byline";

// 台北 10.07 21:30 看完、10.08 23:07 說
const EXPERIENCED = "2026-10-07T13:30:00Z";
const SAID = "2026-10-08T15:07:00Z";

describe("toEpisodeJournal", () => {
  it("一般作品依場域動詞", () => {
    expect(
      toEpisodeJournal({ id: "j1", experienced_at: EXPERIENCED, venue: "home", works: { kind: "movie" } }),
    ).toEqual({ journalId: "j1", experiencedAt: EXPERIENCED, venue: "home", verb: "看完" });
  });

  it("Podcast 作品 → 聽完（works 為陣列也可）", () => {
    expect(
      toEpisodeJournal({
        id: "j1",
        experienced_at: EXPERIENCED,
        venue: "commute",
        works: [{ kind: "podcast_episode" }],
      })?.verb,
    ).toBe("聽完");
  });

  it("沒有作品、場域 live → 聽完", () => {
    expect(toEpisodeJournal({ id: "j1", experienced_at: EXPERIENCED, venue: "live", works: null })?.verb).toBe(
      "聽完",
    );
  });

  it("資料不合法 → null", () => {
    expect(toEpisodeJournal(null)).toBeNull();
    expect(toEpisodeJournal({ id: "j1", experienced_at: EXPERIENCED, venue: "moon" })).toBeNull();
    expect(toEpisodeJournal({ id: "j1", experienced_at: "bad", venue: "home" })).toBeNull();
  });
});

describe("episodeTimeLabel", () => {
  const journal = { journalId: "j1", experiencedAt: EXPERIENCED, venue: "home" as const, verb: "看完" };

  it("有日誌 → 時間差署名", () => {
    expect(episodeTimeLabel({ createdAt: SAID, source: "text", journal })).toBe("10.07 晚上看完・隔天寫的");
  });

  it("電影院 → 帶場域", () => {
    expect(
      episodeTimeLabel({ createdAt: SAID, source: "audio", journal: { ...journal, venue: "cinema" } }),
    ).toBe("10.07 在電影院看完・隔天說的");
  });

  it("沒有日誌 → 維持錄下時刻", () => {
    expect(episodeTimeLabel({ createdAt: SAID, source: "audio", journal: null })).toBe("10.08 23:07 錄下");
    expect(episodeTimeLabel({ createdAt: SAID, source: "text", journal: null })).toBe("10.08 23:07 寫下");
  });

  it("說的時刻不合法 → 退回錄下時刻（也不合法則空字串）", () => {
    expect(journalBylineLabel(journal, "bad")).toBe("");
    expect(episodeTimeLabel({ createdAt: "bad", source: "audio", journal })).toBe("");
  });
});
