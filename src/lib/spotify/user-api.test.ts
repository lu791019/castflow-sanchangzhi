import { describe, expect, it, vi } from "vitest";
import { createSpotifyAppState, SpotifyApiError } from "./api";
import {
  authorizeUrl,
  exchangeCode,
  fetchRecentlyPlayed,
  isNotAllowlisted,
  isRevokedGrant,
  refreshUserToken,
  toRecentPlay,
} from "./user-api";

const URLS = { apiBase: "http://spotify.test/v1", accountsBase: "http://accounts.test" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deps(fetchImpl: (...args: unknown[]) => Promise<Response>) {
  return { fetch: fetchImpl as unknown as typeof fetch, credentials: { clientId: "id", clientSecret: "secret" }, urls: URLS, state: createSpotifyAppState() };
}

describe("authorizeUrl", () => {
  it("authorization code、只要 user-read-recently-played、帶 state 與 redirect_uri", () => {
    const url = new URL(authorizeUrl({ clientId: "cid", redirectUri: "http://127.0.0.1:3000/api/spotify/callback", state: "st", accountsBase: URLS.accountsBase }));
    expect(url.origin + url.pathname).toBe("http://accounts.test/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "cid",
      response_type: "code",
      redirect_uri: "http://127.0.0.1:3000/api/spotify/callback",
      scope: "user-read-recently-played",
      state: "st",
    });
  });
});

describe("exchangeCode／refreshUserToken", () => {
  it("code 換權杖：Basic auth、grant_type=authorization_code、redirect_uri 一字不差", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "a", refresh_token: "r", scope: "user-read-recently-played", expires_in: 3600 }));
    expect(await exchangeCode("CODE", "http://127.0.0.1:3000/api/spotify/callback", deps(fetchImpl))).toEqual({
      accessToken: "a",
      refreshToken: "r",
      scope: "user-read-recently-played",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://accounts.test/api/token");
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      grant_type: "authorization_code",
      code: "CODE",
      redirect_uri: "http://127.0.0.1:3000/api/spotify/callback",
    });
  });

  it("沒有 refresh_token → 丟錯（不存半套）", async () => {
    await expect(exchangeCode("CODE", "x", deps(async () => json({ access_token: "a" })))).rejects.toBeInstanceOf(SpotifyApiError);
  });

  it("refresh：Spotify 換了新的 refresh token 就回傳，沒換回 null", async () => {
    expect(await refreshUserToken("r", deps(async () => json({ access_token: "a2", refresh_token: "r2" })))).toMatchObject({ refreshToken: "r2" });
    expect(await refreshUserToken("r", deps(async () => json({ access_token: "a2" })))).toMatchObject({ refreshToken: null });
  });

  it("使用者撤銷授權：400 invalid_grant → isRevokedGrant", async () => {
    const error = await refreshUserToken("r", deps(async () => json({ error: "invalid_grant", error_description: "Refresh token revoked" }, 400))).catch(
      (caught: unknown) => caught,
    );
    expect(isRevokedGrant(error)).toBe(true);
    expect(String((error as Error).message)).not.toContain("r\"");
  });
});

describe("fetchRecentlyPlayed", () => {
  const item = {
    played_at: "2026-10-16T11:00:00.000Z",
    track: { id: "t1", name: "披星戴月的想你", album: { id: "al1", name: "我肯定在幾百年前就說過愛你", album_type: "album", total_tracks: 10, artists: [{ name: "告五人" }], images: [{ url: "https://i.scdn.co/image/x" }] } },
  };

  it("limit=50、Bearer 使用者權杖，轉成 RecentPlay（缺欄的丟掉）", async () => {
    const fetchImpl = vi.fn(async () => json({ items: [item, { played_at: "x", track: null }, null] }));
    const plays = await fetchRecentlyPlayed("user-token", deps(fetchImpl));
    expect(plays).toEqual([
      {
        playedAt: "2026-10-16T11:00:00.000Z",
        trackId: "t1",
        album: { id: "al1", name: "我肯定在幾百年前就說過愛你", albumType: "album", totalTracks: 10, artists: ["告五人"], imageUrl: "https://i.scdn.co/image/x" },
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://spotify.test/v1/me/player/recently-played?limit=50");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer user-token");
  });

  it("不在允許名單：403 → isNotAllowlisted", async () => {
    const error = await fetchRecentlyPlayed("t", deps(async () => json({ error: { status: 403, message: "User not registered in the Developer Dashboard" } }, 403))).catch(
      (caught: unknown) => caught,
    );
    expect(isNotAllowlisted(error)).toBe(true);
  });

  it("http 圖片、壞時間都不收", () => {
    expect(toRecentPlay({ ...item, played_at: "not-a-date" })).toBeNull();
    expect(toRecentPlay({ ...item, track: { ...item.track, album: { ...item.track.album, images: [{ url: "http://x" }] } } })?.album.imageUrl).toBeNull();
  });
});
