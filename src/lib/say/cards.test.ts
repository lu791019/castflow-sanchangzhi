import { describe, expect, it } from "vitest";
import type { RecentWork } from "@/app/(social)/say/say-stage";
import { buildSayCards, episodeCard, type RecentEpisodeRow } from "./cards";

const card = (id: string, overrides: Partial<RecentWork> = {}): RecentWork => ({
  id,
  workId: `work-${id}`,
  title: id,
  workTitle: id,
  categoryLabel: "電影",
  createdAt: "2026-10-14T12:00:00Z",
  ...overrides,
});

describe("buildSayCards（說一段作品卡的順序）", () => {
  it("深連結預帶 > 最近還沒說的日誌 > 最近說過的作品", () => {
    const cards = buildSayCards({
      prefill: card("prefill"),
      unsaid: card("journal", { journalId: "j1" }),
      recent: [card("ep1")],
    });
    expect(cards.map((c) => c.id)).toEqual(["prefill", "journal", "ep1"]);
  });

  it("沒有預帶時，第一張是剛記、還沒說的那筆", () => {
    const cards = buildSayCards({ prefill: null, unsaid: card("journal", { journalId: "j1" }), recent: [card("ep1")] });
    expect(cards[0]).toMatchObject({ id: "journal", journalId: "j1" });
  });

  it("/say?journal=<id> 與最近還沒說的是同一筆：不重複", () => {
    const same = card("j1", { journalId: "j1" });
    const cards = buildSayCards({ prefill: same, unsaid: { ...same }, recent: [] });
    expect(cards.map((c) => c.id)).toEqual(["j1"]);
  });

  it("說過的作品與前面卡片同作品就略過", () => {
    const cards = buildSayCards({
      prefill: null,
      unsaid: card("journal", { journalId: "j1", workId: "w1" }),
      recent: [card("ep1", { workId: "w1" }), card("ep2", { workId: "w2" })],
    });
    expect(cards.map((c) => c.id)).toEqual(["journal", "ep2"]);
  });

  it("什麼都沒有回空陣列（作品卡顯示「今天看了什麼？」）", () => {
    expect(buildSayCards({ prefill: null, unsaid: null, recent: [] })).toEqual([]);
  });
});

describe("episodeCard（最近說過的作品）", () => {
  const row = (overrides: Partial<RecentEpisodeRow> = {}): RecentEpisodeRow => ({
    id: "ep",
    title: "散場隨筆",
    created_at: "2026-10-13T12:00:00Z",
    work_id: "w1",
    works: { kind: "movie", title: "海街日記", podcast_show: null, poster_url: "https://img/p.jpg" },
    ...overrides,
  });

  it("分類與名稱都從綁定的作品來", () => {
    expect(episodeCard(row())).toEqual({
      id: "ep",
      workId: "w1",
      title: "散場隨筆",
      workTitle: "海街日記",
      categoryLabel: "電影",
      createdAt: "2026-10-13T12:00:00Z",
      verb: "看",
      posterUrl: "https://img/p.jpg",
    });
  });

  it("Podcast 用節目名、動詞是聽", () => {
    const podcast = episodeCard(
      row({ works: { kind: "podcast_episode", title: "EP12 散場", podcast_show: "百靈果", poster_url: null } }),
    );
    expect(podcast).toMatchObject({ workTitle: "百靈果", categoryLabel: "PODCAST", verb: "聽" });
  });

  it("沒綁作品（舊錄音「散場隨筆」）不當作品卡", () => {
    expect(episodeCard(row({ work_id: null, works: null }))).toBeNull();
  });
});
