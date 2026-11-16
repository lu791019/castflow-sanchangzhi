import { describe, expect, it } from "vitest";
import { routeFor as route } from "./mock-router";

function routeFor(pathname: string, search: string, realTrending = false) {
  const target = route(pathname, search, realTrending);
  if (!target) throw new Error(`沒有路由：${pathname}`);
  return target;
}

describe("routeFor", () => {
  it("TMDB 搜尋與詳情：假 server 優先，沒起就真打", () => {
    expect(routeFor("/3/search/multi", "?query=x").candidates).toEqual([
      "http://127.0.0.1:3163/3/search/multi?query=x",
      "https://api.themoviedb.org/3/search/multi?query=x",
    ]);
    expect(routeFor("/3/movie/550", "").candidates).toHaveLength(2);
  });

  it("TMDB 上映／熱門清單：只給假 server（不讓真資料進伺服器快取）", () => {
    expect(routeFor("/3/movie/now_playing", "").candidates).toEqual(["http://127.0.0.1:3163/3/movie/now_playing"]);
    expect(routeFor("/3/trending/tv/week", "").candidates).toEqual(["http://127.0.0.1:3163/3/trending/tv/week"]);
  });

  it("iTunes lookup：音樂假 server → 文化部假 server（/apple/lookup）→ 真 iTunes", () => {
    expect(routeFor("/itunes/lookup", "?id=1").candidates).toEqual([
      "http://127.0.0.1:3267/itunes/lookup?id=1",
      "http://127.0.0.1:3166/apple/lookup?id=1",
      "https://itunes.apple.com/lookup?id=1",
    ]);
  });

  it("假 server 的作品 id（99xxxx）只給假 server，沒起就由路由回假資料，不拿去真 TMDB", () => {
    expect(routeFor("/3/movie/990002", "").candidates).toEqual(["http://127.0.0.1:3163/3/movie/990002"]);
    expect(routeFor("/3/movie/990002", "").fallback?.()).toMatchObject({ id: 990002 });
    expect(routeFor("/3/tv/990010/credits", "").candidates).toEqual(["http://127.0.0.1:3163/3/tv/990010/credits"]);
  });

  it("useRealTrending 時清單與榜單在假 server 之後改真打", () => {
    expect(routeFor("/3/movie/now_playing", "?region=TW", true).candidates).toEqual([
      "http://127.0.0.1:3163/3/movie/now_playing?region=TW",
      "https://api.themoviedb.org/3/movie/now_playing?region=TW",
    ]);
    expect(routeFor("/apple/top.json", "", true).candidates.at(-1)).toMatch(/^https:\/\/rss\.marketingtools\.apple\.com\/.+podcasts/);
    expect(routeFor("/culture", "", true).candidates).toHaveLength(2);
  });

  it("文化部與榜單：只給假 server", () => {
    expect(routeFor("/culture", "?category=1").candidates).toEqual([
      "http://127.0.0.1:3166/culture?category=1",
      "http://127.0.0.1:3267/culture?category=1",
    ]);
  });

  it("其他路徑不轉", () => {
    expect(route("/rss/1.xml", "")).toBeNull();
  });

  it("Spotify：只給假 server，沒起就路由自己回假權杖＋空結果（永遠不真打）", () => {
    const search = routeFor("/spotify/v1/search", "?q=x&type=album");
    expect(search.candidates).toEqual(["http://127.0.0.1:3269/spotify/v1/search?q=x&type=album"]);
    expect(search.fallback?.()).toEqual({ albums: { items: [] }, shows: { items: [] } });
    const token = routeFor("/spotify-accounts/api/token", "");
    expect(token.candidates).toEqual(["http://127.0.0.1:3269/spotify-accounts/api/token"]);
    expect(token.fallback?.()).toMatchObject({ token_type: "Bearer", expires_in: 3600 });
  });
});
