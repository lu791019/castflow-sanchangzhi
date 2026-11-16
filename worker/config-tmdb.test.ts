import { describe, expect, it, vi } from "vitest";
import { searchTmdb } from "../src/lib/work-picker/tmdb.ts";
import { loadWorkerConfig } from "./config.ts";

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  API_SECRET_KEY: "k",
};

describe("worker config：TMDB（補資料 job）", () => {
  it("token 或 key 擇一即啟用；都沒有為 null", () => {
    expect(loadWorkerConfig({ ...REQUIRED, TMDB_READ_ACCESS_TOKEN: " t " }, "/w").tmdb).toEqual({
      readAccessToken: "t",
      apiKey: null,
    });
    expect(loadWorkerConfig({ ...REQUIRED, TMDB_API_KEY: "k3" }, "/w").tmdb).toEqual({
      readAccessToken: null,
      apiKey: "k3",
    });
    expect(loadWorkerConfig(REQUIRED, "/w").tmdb).toBeNull();
  });
});

describe("searchTmdb 年份參數", () => {
  const ok = () => new Response(JSON.stringify({ results: [] }), { status: 200 });

  it("movie 帶 year、tv 帶 first_air_date_year；沒給年份不帶", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => ok());
    const deps = { fetch: fetchFn as unknown as typeof fetch, readAccessToken: "t", apiKey: null };
    await searchTmdb("movie", "海角七號", deps, { year: 2008 });
    await searchTmdb("series", "魷魚遊戲", deps, { year: 2021 });
    await searchTmdb("movie", "海", deps);
    const params = fetchFn.mock.calls.map((call) => new URL(call[0] as string).searchParams);
    expect(params[0].get("year")).toBe("2008");
    expect(params[1].get("first_air_date_year")).toBe("2021");
    expect(params[1].get("year")).toBeNull();
    expect(params[2].get("year")).toBeNull();
  });
});
