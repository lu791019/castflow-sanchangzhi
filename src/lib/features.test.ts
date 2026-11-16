import { describe, expect, it } from "vitest";
import { communityEnabled, spotifyListenEnabled } from "./features";

describe("communityEnabled：社群功能總開關（預設關）", () => {
  it("只有 FEATURE_COMMUNITY=on 才開", () => {
    expect(communityEnabled({ FEATURE_COMMUNITY: "on" })).toBe(true);
    expect(communityEnabled({})).toBe(false);
    expect(communityEnabled({ FEATURE_COMMUNITY: "off" })).toBe(false);
    expect(communityEnabled({ FEATURE_COMMUNITY: "true" })).toBe(false);
  });
});

describe("spotifyListenEnabled：Spotify 收聽紀錄提醒（預設關，migration 041 套了才開）", () => {
  it("只有 FEATURE_SPOTIFY_LISTEN=on 才開", () => {
    expect(spotifyListenEnabled({ FEATURE_SPOTIFY_LISTEN: "on" })).toBe(true);
    expect(spotifyListenEnabled({})).toBe(false);
    expect(spotifyListenEnabled({ FEATURE_SPOTIFY_LISTEN: "1" })).toBe(false);
  });
});
