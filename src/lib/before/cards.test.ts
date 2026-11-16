import { describe, expect, it } from "vitest";
import type { ScreenResult } from "@/lib/work-picker/types";
import {
  buildBeforeCards,
  liveCard,
  liveWindow,
  screenCards,
  type LiveWorkRow,
} from "./cards";

function screen(tmdbId: number, kind: "movie" | "series" = "movie"): ScreenResult {
  return {
    kind,
    tmdbId,
    title: `片${tmdbId}`,
    originalTitle: null,
    year: 2026,
    region: null,
    posterUrl: `https://img/${tmdbId}.jpg`,
    releaseDate: null,
    feelingCount: 0,
  };
}

function live(overrides: Partial<LiveWorkRow> = {}): LiveWorkRow {
  return {
    id: "w1",
    slug: "s1",
    kind: "live",
    title: "落日飛車 2026 巡迴",
    venue: "Legacy",
    event_date: "2026-10-18",
    event_end_date: null,
    poster_url: null,
    ...overrides,
  };
}

describe("liveWindow：今天起 30 天", () => {
  it("跨月計算", () => {
    expect(liveWindow("2026-10-13")).toEqual({ from: "2026-10-13", to: "2026-11-12" });
  });
});

describe("screenCards", () => {
  it("電影正在上映：取前 N、meta、排進行程走 tmdb", () => {
    const cards = screenCards("movie", "now_playing", [screen(1), screen(2), screen(3)], 2);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      key: "movie:1",
      title: "片1",
      posterUrl: "https://img/1.jpg",
      meta: "電影・正在上映",
      plan: { type: "tmdb", kind: "movie", tmdbId: 1 },
      workId: null,
    });
  });
  it("即將上映與影集本週熱門的 meta", () => {
    expect(screenCards("movie", "upcoming", [screen(1)], 4)[0].meta).toBe("電影・即將上映");
    expect(screenCards("series", "trending", [screen(9, "series")], 2)[0].meta).toBe("影集・本週熱門");
  });
});

describe("liveCard", () => {
  it("演出：場地＋日期，預填名稱、場地、日期與晚上 19:30", () => {
    const card = liveCard(live(), "2026-10-13");
    expect(card).toMatchObject({
      key: "work:w1",
      title: "落日飛車 2026 巡迴",
      posterUrl: null,
      meta: "演出・Legacy・10.18",
      workId: "w1",
      placeholder: "live",
      plan: {
        type: "live",
        place: "live",
        name: "落日飛車 2026 巡迴",
        venue: "Legacy",
        dates: "2026.10.18",
        custom: "2026-10-18T19:30",
      },
    });
  });
  it("字卡封面：沒圖時帶場地與日期", () => {
    expect(liveCard(live({ event_end_date: "2026-10-19" }), "2026-10-13").coverDetails).toEqual({
      venue: "Legacy",
      eventDate: "2026-10-18",
      eventEndDate: "2026-10-19",
    });
    expect(screenCards("movie", "now_playing", [screen(1)], 1)[0].coverDetails).toBeUndefined();
  });
  it("多日演出：日期寫成區間", () => {
    const card = liveCard(live({ event_end_date: "2026-10-19" }), "2026-10-13");
    expect(card.meta).toBe("演出・Legacy・10.18 – 10.19");
    expect(card.plan).toMatchObject({ dates: "2026.10.18 – 2026.10.19" });
  });
  it("演出已經開始（多日進行中）：不預填過去的時間", () => {
    const card = liveCard(live({ event_date: "2026-10-12", event_end_date: "2026-10-14" }), "2026-10-13");
    expect(card.plan).toMatchObject({ custom: "" });
  });
  it("展覽進行中：到某天；還沒開展：某天開展；沒場地不列", () => {
    const ongoing = live({ kind: "exhibition", venue: null, event_date: "2026-09-01", event_end_date: "2026-11-30" });
    expect(liveCard(ongoing, "2026-10-13").meta).toBe("展覽・到 11.30");
    expect(liveCard(ongoing, "2026-10-13").placeholder).toBe("exhibition");
    expect(liveCard(ongoing, "2026-10-13").plan).toMatchObject({ place: "exhibition", custom: "" });
    const soon = live({ kind: "exhibition", venue: "北美館", event_date: "2026-10-20", event_end_date: null });
    expect(liveCard(soon, "2026-10-13").meta).toBe("展覽・北美館・10.20 開展");
    expect(liveCard(soon, "2026-10-13").plan).toMatchObject({ custom: "" });
  });
});

describe("buildBeforeCards：輪流排、去重、上限", () => {
  it("正在上映、場外、即將上映、影集輪流排，同一部只出現一次", () => {
    const cards = buildBeforeCards(
      {
        nowPlaying: [screen(1), screen(2), screen(3), screen(4), screen(5)],
        upcoming: [screen(2), screen(6)],
        series: [screen(7, "series"), screen(8, "series"), screen(9, "series")],
        live: [live({ id: "a" }), live({ id: "b" })],
      },
      "2026-10-13",
    );
    expect(cards.map((card) => card.key)).toEqual([
      "movie:1",
      "work:a",
      "movie:6",
      "series:7",
      "movie:2",
      "work:b",
      "series:8",
      "movie:3",
      "movie:4",
    ]);
  });
  it("場外最多 6 筆；全空回空陣列", () => {
    const many = Array.from({ length: 9 }, (_, index) => live({ id: `w${index}` }));
    const cards = buildBeforeCards({ nowPlaying: [], upcoming: [], series: [], live: many }, "2026-10-13");
    expect(cards).toHaveLength(6);
    expect(buildBeforeCards({ nowPlaying: [], upcoming: [], series: [], live: [] }, "2026-10-13")).toEqual([]);
  });
});
