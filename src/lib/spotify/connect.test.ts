import { describe, expect, it, vi } from "vitest";
import { SpotifyApiError } from "./api";
import { CONNECT_MESSAGES, handleSpotifyCallback, isConnectResult, newOAuthState, sameState, settingsUrl, spotifyRedirectUri, type CallbackDeps } from "./connect";
import { TokenKeyError } from "./token-crypto";

const OK_INPUT = { code: "CODE", state: "s1", error: null, cookieState: "s1", userId: "u1" };

function makeDeps(overrides: Partial<CallbackDeps> = {}): CallbackDeps {
  return {
    exchange: vi.fn(async () => ({ accessToken: "a", refreshToken: "r", scope: "user-read-recently-played" })),
    probe: vi.fn(async () => []),
    save: vi.fn(async () => undefined),
    warn: vi.fn(),
    ...overrides,
  };
}

describe("state", () => {
  it("每次不同、夠長；比對要完全一致", () => {
    const a = newOAuthState();
    expect(a).toMatch(/^[\w-]{32}$/);
    expect(newOAuthState()).not.toBe(a);
    expect(sameState(a, a)).toBe(true);
    expect(sameState(a, `${a}x`)).toBe(false);
    expect(sameState(null, a)).toBe(false);
    expect(sameState(a, null)).toBe(false);
  });
});

describe("spotifyRedirectUri", () => {
  it("有 SPOTIFY_REDIRECT_URI 用它（本機 127.0.0.1）；沒有用站台網址", () => {
    expect(spotifyRedirectUri("https://castflow.daydreamdex.com", {})).toBe("https://castflow.daydreamdex.com/api/spotify/callback");
    expect(spotifyRedirectUri("http://localhost:3000/", { SPOTIFY_REDIRECT_URI: "http://127.0.0.1:3000/api/spotify/callback" })).toBe(
      "http://127.0.0.1:3000/api/spotify/callback",
    );
  });
});

describe("handleSpotifyCallback", () => {
  it("state 一致、登入中 → 換權杖、試打最近播放、存 → connected", async () => {
    const deps = makeDeps();
    expect(await handleSpotifyCallback(OK_INPUT, deps)).toBe("connected");
    expect(deps.exchange).toHaveBeenCalledWith("CODE");
    expect(deps.probe).toHaveBeenCalledWith("a");
    expect(deps.save).toHaveBeenCalledWith("u1", "r", "user-read-recently-played");
  });

  it("state 對不上、沒有 cookie、沒登入 → invalid_state，不換權杖（防 CSRF）", async () => {
    for (const input of [{ ...OK_INPUT, state: "s2" }, { ...OK_INPUT, cookieState: null }, { ...OK_INPUT, userId: null }]) {
      const deps = makeDeps();
      expect(await handleSpotifyCallback(input, deps)).toBe("invalid_state");
      expect(deps.exchange).not.toHaveBeenCalled();
    }
  });

  it("使用者在 Spotify 按取消 → denied；其他 error → error", async () => {
    expect(await handleSpotifyCallback({ ...OK_INPUT, code: null, error: "access_denied" }, makeDeps())).toBe("denied");
    expect(await handleSpotifyCallback({ ...OK_INPUT, code: null, error: "server_error" }, makeDeps())).toBe("error");
    expect(await handleSpotifyCallback({ ...OK_INPUT, code: null }, makeDeps())).toBe("error");
  });

  it("不在允許名單（403）→ not_allowed，不存 token、不推警報", async () => {
    const forbidden = new SpotifyApiError("Spotify 讀最近播放失敗：HTTP 403", { status: 403 });
    const deps = makeDeps({ probe: vi.fn(async () => Promise.reject(forbidden)) });
    expect(await handleSpotifyCallback(OK_INPUT, deps)).toBe("not_allowed");
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it("加密金鑰沒設 → unavailable＋警報", async () => {
    const deps = makeDeps({ save: vi.fn(async () => Promise.reject(new TokenKeyError("沒有 SPOTIFY_TOKEN_KEY"))) });
    expect(await handleSpotifyCallback(OK_INPUT, deps)).toBe("unavailable");
    expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining("SPOTIFY_TOKEN_KEY"), expect.any(String));
  });

  it("交換失敗、DB 寫入失敗 → error＋警報", async () => {
    const deps = makeDeps({ exchange: vi.fn(async () => Promise.reject(new SpotifyApiError("HTTP 400（invalid_grant）", { status: 400, code: "invalid_grant" }))) });
    expect(await handleSpotifyCallback(OK_INPUT, deps)).toBe("error");
    expect(deps.warn).toHaveBeenCalledWith("Spotify 連結失敗", expect.stringContaining("user=u1"));
  });
});

describe("結果文案", () => {
  it("每種結果都有文案；不在名單講清楚是測試階段名額有限", () => {
    expect(isConnectResult("connected")).toBe(true);
    expect(isConnectResult("nope")).toBe(false);
    expect(CONNECT_MESSAGES.not_allowed.text).toContain("測試階段，名額有限");
    expect(settingsUrl("denied")).toBe("/me/settings?spotify=denied#spotify");
  });
});
