import { describe, expect, it } from "vitest";
import { buildSearchLinks, cleanQuery, ticketSiteOrder } from "./search-links";

const enc = encodeURIComponent;

describe("cleanQuery", () => {
  it("去前後空白、合併空白；拿掉拓元／OPENTIX 路徑不收的斜線與句點", () => {
    expect(cleanQuery("  落日飛車  2026 巡迴 ")).toBe("落日飛車 2026 巡迴");
    expect(cleanQuery("A/B. 音樂會")).toBe("A B 音樂會");
  });
});

describe("ticketSiteOrder：venue_type 決定前兩顆", () => {
  it("音樂廳、劇場 → OPENTIX 第一", () => {
    expect(ticketSiteOrder("live", "concert_hall").slice(0, 2)).toEqual(["opentix", "kktix"]);
    expect(ticketSiteOrder("live", "theater")[0]).toBe("opentix");
  });
  it("Live House、音樂祭 → KKTIX 第一", () => {
    expect(ticketSiteOrder("live", "livehouse").slice(0, 2)).toEqual(["kktix", "accupass"]);
    expect(ticketSiteOrder("live", "festival")[0]).toBe("kktix");
  });
  it("體育館 → 拓元第一", () => {
    expect(ticketSiteOrder("live", "arena").slice(0, 2)).toEqual(["tixcraft", "kktix"]);
  });
  it("美術館、博物館 → 官網第一", () => {
    expect(ticketSiteOrder("exhibition", "museum")[0]).toBe("official");
    expect(ticketSiteOrder("exhibition", "history_museum")[0]).toBe("official");
  });
  it("特展 → Klook／KKday 在前", () => {
    expect(ticketSiteOrder("exhibition", "special").slice(0, 2)).toEqual(["klook", "kkday"]);
  });
  it("沒選類型：演出 KKTIX、拓元；展覽官網", () => {
    expect(ticketSiteOrder("live", null).slice(0, 2)).toEqual(["kktix", "tixcraft"]);
    expect(ticketSiteOrder("exhibition", null)[0]).toBe("official");
  });
});

describe("buildSearchLinks", () => {
  it("演出：實測過的各站搜尋網址格式", () => {
    const links = buildSearchLinks({ kind: "live", venueType: null, title: "落日飛車" });
    const byId = Object.fromEntries(links.map((link) => [link.source, link]));
    expect(byId.kktix.url).toBe(`https://kktix.com/events?search=${enc("落日飛車")}`);
    expect(byId.opentix.url).toBe(`https://www.opentix.life/search/${enc("落日飛車")}`);
    expect(byId.tixcraft.url).toBe(`https://www.google.com/search?q=${enc("落日飛車 site:tixcraft.com")}`);
    expect(links.every((link) => link.kind === "ticket" && link.origin === "search" && link.note === "搜尋")).toBe(true);
  });

  it("展覽：官網走 Google「名稱 官網」，kind 是 official", () => {
    const links = buildSearchLinks({ kind: "exhibition", venueType: "museum", title: "光的抄寫" });
    expect(links[0]).toMatchObject({
      kind: "official",
      source: "official",
      label: "官網",
      url: `https://www.google.com/search?q=${enc("光的抄寫 官網")}`,
    });
    const kkday = links.find((link) => link.source === "kkday");
    expect(kkday?.url).toBe(`https://www.kkday.com/zh-tw/product/productlist?keyword=${enc("光的抄寫")}`);
    const klook = links.find((link) => link.source === "klook");
    expect(klook?.url).toBe(`https://www.google.com/search?q=${enc("光的抄寫 site:klook.com")}`);
  });

  it("影劇：JustWatch 搜尋；上映中的電影多一顆查場次", () => {
    expect(buildSearchLinks({ kind: "series", venueType: null, title: "怪奇物語" })).toEqual([
      {
        kind: "watch",
        source: "justwatch",
        label: "JustWatch",
        url: `https://www.justwatch.com/tw/search?q=${enc("怪奇物語")}`,
        origin: "search",
        note: "搜尋",
      },
    ]);
    const movie = buildSearchLinks({ kind: "movie", venueType: null, title: "墜 2", inTheaters: true });
    expect(movie.map((link) => link.kind)).toEqual(["ticket", "watch"]);
    expect(movie[0]).toMatchObject({ label: "查場次", url: `https://www.google.com/search?q=${enc("墜 2 時刻表 site:atmovies.com.tw")}` });
  });

  it("Podcast 或空標題 → 沒有搜尋連結", () => {
    expect(buildSearchLinks({ kind: "podcast_episode", venueType: null, title: "x" })).toEqual([]);
    expect(buildSearchLinks({ kind: "live", venueType: null, title: " / " })).toEqual([]);
  });
});
