import { describe, expect, it, vi } from "vitest";
import { SpotifyApiError } from "../src/lib/spotify/api.ts";
import type { RecentPlay } from "../src/lib/spotify/user-api.ts";
import type { Notify } from "./notify.ts";
import { processListenPrompts, type ListenDeps } from "./spotify-listen.ts";

const NOW = new Date("2026-10-16T12:00:00Z");
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function albumPlays(albumId: string, count: number): RecentPlay[] {
  return Array.from({ length: count }, (_, index) => ({
    playedAt: new Date(NOW.getTime() - (60 - index * 4) * 60_000).toISOString(),
    trackId: `${albumId}-${index}`,
    album: { id: albumId, name: "帶你飛", albumType: "album", totalTracks: 10, artists: ["告五人"], imageUrl: null },
  }));
}

function makeDeps(overrides: Partial<ListenDeps> = {}): ListenDeps & { notify: ReturnType<typeof vi.fn> } {
  const notify = vi.fn(async () => undefined) as unknown as Notify & ReturnType<typeof vi.fn>;
  return {
    listDue: vi.fn(async () => [{ userId: USER, refreshTokenEnc: "v1:x:y:z" }]),
    decrypt: vi.fn(() => "refresh-1"),
    refresh: vi.fn(async () => ({ accessToken: "access-1", refreshToken: null, scope: "user-read-recently-played" })),
    saveRotated: vi.fn(async () => undefined),
    fetchPlays: vi.fn(async () => albumPlays("A", 5)),
    markPolled: vi.fn(async () => undefined),
    markRevoked: vi.fn(async () => undefined),
    createPrompt: vi.fn(async () => true),
    listSubscriptions: vi.fn(async () => [
      { endpoint: "https://push.example/mine", keys: { p256dh: "p", auth: "a" }, userId: USER },
      { endpoint: "https://push.example/other", keys: { p256dh: "p", auth: "a" }, userId: OTHER },
    ]),
    sendPush: vi.fn(async () => ({ ok: true as const })),
    removeSubscription: vi.fn(async () => undefined),
    now: () => NOW,
    ...overrides,
    notify: (overrides.notify as ListenDeps["notify"] & ReturnType<typeof vi.fn>) ?? notify,
  } as ListenDeps & { notify: ReturnType<typeof vi.fn> };
}

describe("processListenPrompts", () => {
  it("聽完一張 → 建提醒（記一筆＋預選專輯的網址、當天去重鍵）、只推給本人", async () => {
    const deps = makeDeps();
    const result = await processListenPrompts(deps);
    expect(result).toEqual({ polled: 1, prompted: 1, pushed: 1, revoked: 0, failed: 0, rateLimited: false });
    expect(deps.decrypt).toHaveBeenCalledWith({ userId: USER, refreshTokenEnc: "v1:x:y:z" });
    expect(deps.refresh).toHaveBeenCalledWith("refresh-1");
    expect(deps.fetchPlays).toHaveBeenCalledWith("access-1");
    expect(deps.createPrompt).toHaveBeenCalledWith(USER, {
      title: "要不要記一筆《帶你飛》？",
      body: "告五人・剛剛聽了 5 首",
      url: "/journal/new?spotifyAlbum=A",
      dedupeKey: "spotify-album:A:2026-10-16",
    });
    expect(deps.sendPush).toHaveBeenCalledTimes(1);
    expect((deps.sendPush as ReturnType<typeof vi.fn>).mock.calls[0][0].endpoint).toBe("https://push.example/mine");
    expect((deps.sendPush as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ url: "/journal/new?spotifyAlbum=A", tag: "listen-A" });
    expect(deps.markPolled).toHaveBeenCalledWith(USER, null);
  });

  it("同一張今天問過（createPrompt 回 false）→ 不推", async () => {
    const deps = makeDeps({ createPrompt: vi.fn(async () => false) });
    expect(await processListenPrompts(deps)).toMatchObject({ polled: 1, prompted: 0, pushed: 0 });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("還沒聽完 → 不建、照樣寫 last_polled_at", async () => {
    const deps = makeDeps({ fetchPlays: vi.fn(async () => albumPlays("A", 2)) });
    expect(await processListenPrompts(deps)).toMatchObject({ polled: 1, prompted: 0 });
    expect(deps.createPrompt).not.toHaveBeenCalled();
    expect(deps.markPolled).toHaveBeenCalledWith(USER, null);
  });

  it("Spotify 換了新的 refresh token → 存回（加密在 deps 裡做）", async () => {
    const deps = makeDeps({ refresh: vi.fn(async () => ({ accessToken: "a", refreshToken: "refresh-2", scope: "" })) });
    await processListenPrompts(deps);
    expect(deps.saveRotated).toHaveBeenCalledWith(USER, "refresh-2");
  });

  it("使用者撤銷授權（invalid_grant）→ 標 revoked、info 警報、算撤銷", async () => {
    const revoked = new SpotifyApiError("HTTP 400（invalid_grant）", { status: 400, code: "invalid_grant" });
    const deps = makeDeps({ refresh: vi.fn(async () => Promise.reject(revoked)) });
    expect(await processListenPrompts(deps)).toMatchObject({ polled: 1, revoked: 1, failed: 0 });
    expect(deps.markRevoked).toHaveBeenCalledWith(USER, expect.stringContaining("invalid_grant"));
    expect(deps.notify).toHaveBeenCalledWith("info", expect.stringContaining("連結失效"), expect.stringContaining(USER));
  });

  it("被移出允許名單（403）→ 一樣標 revoked", async () => {
    const forbidden = new SpotifyApiError("HTTP 403", { status: 403 });
    const deps = makeDeps({ fetchPlays: vi.fn(async () => Promise.reject(forbidden)) });
    expect(await processListenPrompts(deps)).toMatchObject({ revoked: 1 });
    expect(deps.markRevoked).toHaveBeenCalledWith(USER, expect.stringContaining("403"));
  });

  it("429 → 警報、這輪其餘的人不拉", async () => {
    const quota = new SpotifyApiError("HTTP 429（QUOTA_EXCEEDED）", { status: 429, rateLimited: true, quotaExceeded: true });
    const deps = makeDeps({
      listDue: vi.fn(async () => [
        { userId: USER, refreshTokenEnc: "a" },
        { userId: OTHER, refreshTokenEnc: "b" },
      ]),
      fetchPlays: vi.fn(async () => Promise.reject(quota)),
    });
    expect(await processListenPrompts(deps)).toMatchObject({ polled: 0, rateLimited: true });
    expect(deps.refresh).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("429"), expect.stringContaining("QUOTA_EXCEEDED"));
  });

  it("其他失敗（解不開、網路）→ 記 last_error＋warn，下一位照跑", async () => {
    const deps = makeDeps({
      listDue: vi.fn(async () => [
        { userId: USER, refreshTokenEnc: "bad" },
        { userId: OTHER, refreshTokenEnc: "ok" },
      ]),
      decrypt: vi.fn((connection) => {
        if (connection.userId === USER) throw new Error("Unsupported state or unable to authenticate data");
        return "refresh-ok";
      }),
    });
    expect(await processListenPrompts(deps)).toMatchObject({ polled: 2, failed: 1, prompted: 1 });
    expect(deps.markPolled).toHaveBeenCalledWith(USER, expect.stringContaining("unable to authenticate"));
    expect(deps.notify).toHaveBeenCalledWith("warn", "Spotify 收聽紀錄拉取失敗", expect.stringContaining(USER));
  });

  it("讀連結失敗（例如 migration 還沒套）→ 警報、不丟例外", async () => {
    const deps = makeDeps({ listDue: vi.fn(async () => Promise.reject(new Error('relation "spotify_connections" does not exist'))) });
    expect(await processListenPrompts(deps)).toMatchObject({ polled: 0 });
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("migration 041"), expect.any(String));
  });

  it("沒有人連結 → 不讀推播訂閱", async () => {
    const deps = makeDeps({ listDue: vi.fn(async () => []) });
    await processListenPrompts(deps);
    expect(deps.listSubscriptions).not.toHaveBeenCalled();
  });
});
