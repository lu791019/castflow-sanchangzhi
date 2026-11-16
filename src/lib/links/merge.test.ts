import { describe, expect, it } from "vitest";
import { mergeWorkLinks, primaryLink, withAddedLink } from "./merge";
import type { WorkLink, WorkLinksView } from "./types";

function link(partial: Partial<WorkLink> & Pick<WorkLink, "source" | "origin">): WorkLink {
  return { kind: "watch", label: partial.source, url: `https://x.test/${partial.source}/${partial.origin}`, note: null, ...partial };
}

describe("mergeWorkLinks：優先序 user > manual > curated > tmdb > search", () => {
  it("同一 kind＋source 只留最優先的一筆，並依優先序排列", () => {
    const view = mergeWorkLinks("series", [
      link({ source: "netflix", origin: "tmdb" }),
      link({ source: "justwatch", origin: "search" }),
      link({ source: "netflix", origin: "curated" }),
      link({ source: "disneyplus", origin: "user" }),
      link({ source: "netflix", origin: "user", url: "https://www.netflix.com/title/1" }),
    ]);
    expect(view.watch.map((item) => `${item.source}:${item.origin}`)).toEqual([
      "disneyplus:user",
      "netflix:user",
      "justwatch:search",
    ]);
    expect(view.watch[1].url).toBe("https://www.netflix.com/title/1");
    expect(view.missing).toBe(false);
  });

  it("依 kind 分到 watch／ticket／official", () => {
    const view = mergeWorkLinks("live", [
      link({ kind: "ticket", source: "kktix", origin: "manual" }),
      link({ kind: "ticket", source: "kktix", origin: "search" }),
      link({ kind: "ticket", source: "tixcraft", origin: "search" }),
      link({ kind: "official", source: "official", origin: "search" }),
    ]);
    expect(view.ticket.map((item) => `${item.source}:${item.origin}`)).toEqual(["kktix:manual", "tixcraft:search"]);
    expect(view.official).toHaveLength(1);
    expect(view.watch).toEqual([]);
    expect(view.missing).toBe(false);
  });

  it("只有搜尋連結 → missing", () => {
    const view = mergeWorkLinks("exhibition", [link({ kind: "official", source: "official", origin: "search" })]);
    expect(view.missing).toBe(true);
  });

  it("Podcast 不參與（在哪聽另有區塊）→ 空且不算缺", () => {
    expect(mergeWorkLinks("podcast_episode", [link({ source: "x", origin: "user" })])).toEqual({
      watch: [],
      ticket: [],
      official: [],
      missing: false,
    });
  });
});

describe("primaryLink：列表次鈕只放一顆", () => {
  it("真連結優先於搜尋；演出售票先於官網", () => {
    expect(
      primaryLink("live", [
        link({ kind: "ticket", source: "kktix", origin: "search" }),
        link({ kind: "official", source: "official", origin: "user" }),
        link({ kind: "ticket", source: "opentix", origin: "manual" }),
      ])?.source,
    ).toBe("opentix");
    expect(
      primaryLink("live", [
        link({ kind: "ticket", source: "kktix", origin: "search" }),
        link({ kind: "official", source: "official", origin: "user" }),
      ])?.source,
    ).toBe("official");
  });

  it("只有搜尋 → 照 venue_type 排好的順序取第一顆", () => {
    expect(
      primaryLink("exhibition", [
        link({ kind: "official", source: "official", origin: "search" }),
        link({ kind: "ticket", source: "klook", origin: "search" }),
      ])?.source,
    ).toBe("official");
    expect(
      primaryLink("movie", [
        link({ kind: "ticket", source: "showtimes-search", origin: "search" }),
        link({ source: "justwatch", origin: "search" }),
      ])?.source,
    ).toBe("showtimes-search");
  });

  it("影劇：在哪看先於訂票；Podcast 沒有", () => {
    expect(
      primaryLink("movie", [
        link({ kind: "ticket", source: "vieshow", origin: "user" }),
        link({ source: "netflix", origin: "tmdb" }),
      ])?.source,
    ).toBe("netflix");
    expect(primaryLink("podcast_episode", [link({ source: "x", origin: "user" })])).toBeNull();
  });
});

describe("withAddedLink", () => {
  const link = (source: string, url: string, origin: WorkLink["origin"] = "user"): WorkLink => ({ kind: "watch", source, label: source, url, origin, note: null });

  it("讀者剛補的連結放到同類第一個、不再缺，原本的 view 不動", () => {
    const view: WorkLinksView = { watch: [link("justwatch", "https://www.justwatch.com/tw/search?q=x", "search")], ticket: [], official: [], missing: true };
    const next = withAddedLink(view, link("netflix", "https://www.netflix.com/title/1"));
    expect(next.watch.map((item) => item.source)).toEqual(["netflix", "justwatch"]);
    expect(next.missing).toBe(false);
    expect(view.watch).toHaveLength(1);
    expect(view.missing).toBe(true);
  });

  it("同來源只留新的那一筆", () => {
    const view: WorkLinksView = { watch: [link("netflix", "https://www.netflix.com/title/old")], ticket: [], official: [], missing: false };
    const next = withAddedLink(view, link("netflix", "https://www.netflix.com/title/new"));
    expect(next.watch.map((item) => item.url)).toEqual(["https://www.netflix.com/title/new"]);
  });
});
