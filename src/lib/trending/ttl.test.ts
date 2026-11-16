import { describe, expect, it } from "vitest";
import { TRENDING_TTL_MS, trendingTtlFromEnv } from "./ttl";

describe("trendingTtlFromEnv", () => {
  it("沒設照預設一小時", () => {
    expect(trendingTtlFromEnv({ NODE_ENV: "development" })).toBe(TRENDING_TTL_MS);
  });

  it("可覆寫時吃 TRENDING_CACHE_TTL_MS（含 0）", () => {
    expect(trendingTtlFromEnv({ NODE_ENV: "development", TRENDING_CACHE_TTL_MS: "0" })).toBe(0);
    expect(trendingTtlFromEnv({ NODE_ENV: "production", E2E_EXTERNAL_MOCKS: "on", TRENDING_CACHE_TTL_MS: "500" })).toBe(500);
  });

  it("正式環境與壞值不吃", () => {
    expect(trendingTtlFromEnv({ NODE_ENV: "production", TRENDING_CACHE_TTL_MS: "0" })).toBe(TRENDING_TTL_MS);
    expect(trendingTtlFromEnv({ NODE_ENV: "development", TRENDING_CACHE_TTL_MS: "-1" })).toBe(TRENDING_TTL_MS);
    expect(trendingTtlFromEnv({ NODE_ENV: "development", TRENDING_CACHE_TTL_MS: "abc" })).toBe(TRENDING_TTL_MS);
  });
});
