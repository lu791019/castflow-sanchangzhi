import { describe, expect, it, vi } from "vitest";
import {
  createSpotifyAppState,
  getAppToken,
  getSpotifyAlbum,
  isQuotaBody,
  searchSpotifyAlbums,
  searchSpotifyShows,
  SpotifyApiError,
  spotifyCredentialsFromEnv,
  spotifyUrlsFromEnv,
  SPOTIFY_API_BASE,
  type SpotifyAppDeps,
} from "./api";

const URLS = { apiBase: "http://spotify.test/v1", accountsBase: "http://accounts.test" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function deps(fetchImpl: typeof fetch, now = () => 1_000_000): SpotifyAppDeps {
  return { fetch: fetchImpl, credentials: { clientId: "id", clientSecret: "secret" }, urls: URLS, state: createSpotifyAppState(), now };
}

function tokenThen(...responses: Response[]) {
  const queue = [json({ access_token: "tok-1", token_type: "Bearer", expires_in: 3600 }), ...responses];
  return vi.fn(async () => queue.shift() ?? json({}, 500));
}

describe("env", () => {
  it("金鑰兩個都有才算設定", () => {
    expect(spotifyCredentialsFromEnv({ SPOTIFY_CLIENT_ID: "a", SPOTIFY_CLIENT_SECRET: "b" })).toEqual({ clientId: "a", clientSecret: "b" });
    expect(spotifyCredentialsFromEnv({ SPOTIFY_CLIENT_ID: "a" })).toBeNull();
  });

  it("網址覆寫只給非 production 或 E2E 打包版；Cloud Run 不吃", () => {
    expect(spotifyUrlsFromEnv({ NODE_ENV: "development", SPOTIFY_API_BASE: "http://x/v1" }).apiBase).toBe("http://x/v1");
    expect(spotifyUrlsFromEnv({ NODE_ENV: "production", SPOTIFY_API_BASE: "http://x/v1" }).apiBase).toBe(SPOTIFY_API_BASE);
    expect(
      spotifyUrlsFromEnv({ NODE_ENV: "production", E2E_EXTERNAL_MOCKS: "on", K_SERVICE: "castflow", SPOTIFY_API_BASE: "http://x/v1" }).apiBase,
    ).toBe(SPOTIFY_API_BASE);
  });
});

describe("getAppToken", () => {
  it("client credentials（Basic auth）拿權杖，快取到過期前 60 秒", async () => {
    let now = 1_000_000;
    const fetchImpl = vi.fn(async () => json({ access_token: "tok-1", expires_in: 3600 }));
    const d = deps(fetchImpl as unknown as typeof fetch, () => now);
    expect(await getAppToken(d)).toBe("tok-1");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://accounts.test/api/token");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("id:secret").toString("base64")}`);
    expect(init.body).toBe("grant_type=client_credentials");

    now += 3_500_000; // 還沒進入最後 60 秒
    await getAppToken(d);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += 50_000; // 剩不到 60 秒 → 換新
    await getAppToken(d);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("權杖端點失敗 → SpotifyApiError", async () => {
    const d = deps((async () => json({ error: "invalid_client" }, 400)) as unknown as typeof fetch);
    await expect(getAppToken(d)).rejects.toMatchObject({ name: "SpotifyApiError", status: 400 });
  });
});

describe("search", () => {
  it("專輯：帶 market=TW、limit=10，轉成候選（濾掉 null 與缺 id 的）", async () => {
    const fetchImpl = tokenThen(
      json({
        albums: {
          items: [
            { id: "a1", name: "帶你飛", album_type: "album", total_tracks: 10, artists: [{ name: "告五人" }] },
            null,
            { name: "沒有 id" },
          ],
        },
      }),
    );
    const albums = await searchSpotifyAlbums("帶你飛 告五人", deps(fetchImpl as unknown as typeof fetch));
    expect(albums).toEqual([{ id: "a1", name: "帶你飛", album_type: "album", total_tracks: 10, artists: ["告五人"] }]);
    const url = new URL((fetchImpl.mock.calls[1] as unknown as [string])[0]);
    expect(url.pathname).toBe("/v1/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "帶你飛 告五人", type: "album", market: "TW", limit: "10" });
  });

  it("節目：沒有 publisher 欄（開發模式）→ null", async () => {
    const fetchImpl = tokenThen(json({ shows: { items: [{ id: "s1", name: "Gooaye 股癌", description: "聊投資" }] } }));
    expect(await searchSpotifyShows("股癌", deps(fetchImpl as unknown as typeof fetch))).toEqual([
      { id: "s1", name: "Gooaye 股癌", publisher: null, description: "聊投資" },
    ]);
  });

  it("401 → 丟掉快取權杖重拿一次", async () => {
    const queue = [
      json({ access_token: "tok-1", expires_in: 3600 }),
      json({}, 401),
      json({ access_token: "tok-2", expires_in: 3600 }),
      json({ albums: { items: [] } }),
    ];
    const fetchImpl = vi.fn(async () => queue.shift() as Response);
    expect(await searchSpotifyAlbums("x", deps(fetchImpl as unknown as typeof fetch))).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("429 QUOTA_EXCEEDED → rateLimited＋quotaExceeded，之後在 Retry-After 內不再打（冷卻）", async () => {
    let now = 1_000_000;
    const fetchImpl = tokenThen(json({ error: { status: 429, message: "quota", reason: "QUOTA_EXCEEDED" } }, 429, { "Retry-After": "120" }));
    const d = deps(fetchImpl as unknown as typeof fetch, () => now);
    const first = await searchSpotifyAlbums("x", d).catch((error: unknown) => error);
    expect(first).toBeInstanceOf(SpotifyApiError);
    expect(first).toMatchObject({ status: 429, rateLimited: true, quotaExceeded: true, cooling: false, retryAfterMs: 120_000 });
    expect(String((first as Error).message)).not.toContain("tok-1");

    const second = await searchSpotifyAlbums("x", d).catch((error: unknown) => error);
    expect(second).toMatchObject({ cooling: true, rateLimited: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    now += 121_000;
    fetchImpl.mockResolvedValueOnce(json({ albums: { items: [] } }));
    expect(await searchSpotifyAlbums("x", d)).toEqual([]);
  });

  it("沒給 Retry-After 的 429 → 預設冷卻 10 分鐘", async () => {
    let now = 0;
    const fetchImpl = tokenThen(json({ error: { status: 429 } }, 429));
    const d = deps(fetchImpl as unknown as typeof fetch, () => now);
    await expect(searchSpotifyAlbums("x", d)).rejects.toMatchObject({ rateLimited: true, quotaExceeded: false });
    now += 9 * 60_000;
    await expect(searchSpotifyAlbums("x", d)).rejects.toMatchObject({ cooling: true });
  });

  it("連線失敗 → status null", async () => {
    const d = deps((async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch);
    await expect(searchSpotifyAlbums("x", d)).rejects.toMatchObject({ status: null });
  });

  it("QUOTA_EXCEEDED 頂層或 error 內都認", () => {
    expect(isQuotaBody({ reason: "QUOTA_EXCEEDED" })).toBe(true);
    expect(isQuotaBody({ error: { reason: "QUOTA_EXCEEDED" } })).toBe(true);
    expect(isQuotaBody({ error: { status: 429 } })).toBe(false);
  });
});

describe("getSpotifyAlbum", () => {
  it("讀單張專輯（market=TW），只收 https 封面；404 回 null", async () => {
    const fetchImpl = tokenThen(
      json({ id: "al1", name: "帶你飛", album_type: "album", total_tracks: 10, artists: [{ name: "告五人" }], images: [{ url: "https://i.scdn.co/x" }] }),
    );
    expect(await getSpotifyAlbum("al1", deps(fetchImpl as unknown as typeof fetch))).toEqual({
      id: "al1",
      name: "帶你飛",
      album_type: "album",
      total_tracks: 10,
      artists: ["告五人"],
      imageUrl: "https://i.scdn.co/x",
    });
    expect((fetchImpl.mock.calls[1] as unknown as [string])[0]).toBe("http://spotify.test/v1/albums/al1?market=TW");
    expect(await getSpotifyAlbum("nope", deps(tokenThen(json({ error: { status: 404 } }, 404)) as unknown as typeof fetch))).toBeNull();
  });
});

