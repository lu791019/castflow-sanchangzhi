import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPOTIFY_LISTEN_INTERVAL_MINUTES, loadWorkerConfig } from "./config.ts";

const BASE = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "service-key", API_SECRET_KEY: "api-key" };
const KEY = randomBytes(32).toString("base64");
const FULL = { ...BASE, WORKER_SPOTIFY_LISTEN: "on", SPOTIFY_CLIENT_ID: "id", SPOTIFY_CLIENT_SECRET: "secret", SPOTIFY_TOKEN_KEY: KEY };

describe("spotifyListen 設定（Q-64 C1）", () => {
  it("預設關、每 20 分", () => {
    const { spotifyListen } = loadWorkerConfig(BASE, "/w");
    expect(spotifyListen.enabled).toBe(false);
    expect(spotifyListen.intervalMs).toBe(DEFAULT_SPOTIFY_LISTEN_INTERVAL_MINUTES * 60_000);
  });

  it("WORKER_SPOTIFY_LISTEN=on＋金鑰齊 → 可跑、沒有 problem", () => {
    const { spotifyListen } = loadWorkerConfig({ ...FULL, SPOTIFY_LISTEN_INTERVAL_MINUTES: "15" }, "/w");
    expect(spotifyListen).toMatchObject({ enabled: true, intervalMs: 15 * 60_000, credentials: { clientId: "id", clientSecret: "secret" }, problem: null });
    expect(spotifyListen.tokenKey?.length).toBe(32);
  });

  it("開了但缺 client 或加密金鑰 → problem 寫原因（不印金鑰）", () => {
    const missing = loadWorkerConfig({ ...BASE, WORKER_SPOTIFY_LISTEN: "on" }, "/w").spotifyListen;
    expect(missing.problem).toContain("SPOTIFY_CLIENT_ID");
    expect(missing.problem).toContain("SPOTIFY_TOKEN_KEY");
    const badKey = loadWorkerConfig({ ...FULL, SPOTIFY_TOKEN_KEY: "c2hvcnQ=" }, "/w").spotifyListen;
    expect(badKey.tokenKey).toBeNull();
    expect(badKey.problem).toContain("32 bytes");
    expect(badKey.problem).not.toContain("c2hvcnQ=");
  });

  it("間隔要 5–120 分的整數", () => {
    expect(() => loadWorkerConfig({ ...BASE, SPOTIFY_LISTEN_INTERVAL_MINUTES: "2" }, "/w")).toThrow(/5–120/);
    expect(() => loadWorkerConfig({ ...BASE, SPOTIFY_LISTEN_INTERVAL_MINUTES: "200" }, "/w")).toThrow(/5–120/);
    expect(() => loadWorkerConfig({ ...BASE, SPOTIFY_LISTEN_INTERVAL_MINUTES: "7.5" }, "/w")).toThrow(/5–120/);
  });
});
