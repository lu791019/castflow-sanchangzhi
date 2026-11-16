import { describe, expect, it, vi } from "vitest";
import type { TmdbDeps } from "@/lib/work-picker/tmdb";
import {
  deriveWatchStatus,
  fetchWatchSnapshot,
  parseRegionProviders,
  parseStoredSnapshot,
  type WatchSnapshot,
} from "./providers";

const TW_LINK = "https://www.themoviedb.org/movie/315846-diary/watch?locale=TW";

// 形狀取自 2026-10 實打 TMDB movie/315846/watch/providers 的 results.TW
const UMIMACHI = {
  id: 315846,
  results: {
    TW: {
      link: TW_LINK,
      rent: [{ logo_path: "/a.png", provider_id: 2, provider_name: "Apple TV Store", display_priority: 8 }],
      buy: [{ logo_path: "/a.png", provider_id: 2, provider_name: "Apple TV Store", display_priority: 8 }],
    },
    JP: { link: "https://x/jp", flatrate: [{ provider_name: "U-NEXT", display_priority: 1 }] },
  },
};

function snapshot(overrides: Partial<WatchSnapshot> = {}): WatchSnapshot {
  return { providers: [], link: null, releaseDate: null, ...overrides };
}

describe("parseRegionProviders", () => {
  it("只取 TW；同平台租買只列一次（取較優先的 rent）；每列連到 TMDB link", () => {
    expect(parseRegionProviders(UMIMACHI)).toEqual({
      link: TW_LINK,
      providers: [{ name: "Apple TV Store", kind: "rent", link: TW_LINK }],
    });
  });

  it("flatrate 優先，各類內依 display_priority 排序", () => {
    const data = {
      results: {
        TW: {
          link: "L",
          buy: [{ provider_name: "Google Play", display_priority: 3 }],
          flatrate: [
            { provider_name: "Disney Plus", display_priority: 5 },
            { provider_name: "Netflix", display_priority: 0 },
          ],
          rent: [{ provider_name: "Apple TV Store", display_priority: 8 }],
        },
      },
    };
    expect(parseRegionProviders(data).providers.map((p) => `${p.kind}:${p.name}`)).toEqual([
      "subscription:Netflix",
      "subscription:Disney Plus",
      "rent:Apple TV Store",
      "buy:Google Play",
    ]);
  });

  it("沒有 TW、沒有 link、壞資料 → 空", () => {
    expect(parseRegionProviders({ results: { JP: UMIMACHI.results.JP } })).toEqual({ providers: [], link: null });
    expect(parseRegionProviders({ results: { TW: { flatrate: [{ provider_name: "Netflix" }] } } })).toEqual({
      providers: [],
      link: null,
    });
    expect(parseRegionProviders(null)).toEqual({ providers: [], link: null });
    expect(parseRegionProviders({ results: { TW: { link: "L", flatrate: [null, { provider_name: "" }] } } })).toEqual({
      providers: [],
      link: "L",
    });
  });
});

describe("deriveWatchStatus", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("有平台 → available", () => {
    expect(
      deriveWatchStatus(snapshot({ providers: [{ name: "Netflix", kind: "subscription", link: "L" }] }), now),
    ).toBe("available");
  });
  it("無平台、上映 60 天內 → in_theaters；超過 60 天、尚未上映、無日期 → none", () => {
    expect(deriveWatchStatus(snapshot({ releaseDate: "2026-09-01" }), now)).toBe("in_theaters");
    expect(deriveWatchStatus(snapshot({ releaseDate: "2026-08-12" }), now)).toBe("in_theaters");
    expect(deriveWatchStatus(snapshot({ releaseDate: "2026-08-01" }), now)).toBe("none");
    expect(deriveWatchStatus(snapshot({ releaseDate: "2026-11-01" }), now)).toBe("none");
    expect(deriveWatchStatus(snapshot(), now)).toBe("none");
    expect(deriveWatchStatus(null, now)).toBe("none");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deps(fetchFn: ReturnType<typeof vi.fn>): TmdbDeps {
  return { fetch: fetchFn as unknown as typeof fetch, readAccessToken: "tok", apiKey: null };
}

describe("fetchWatchSnapshot", () => {
  it("電影：movie/{id}?append_to_response=watch/providers，帶 release_date", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ id: 315846, release_date: "2015-06-13", "watch/providers": UMIMACHI }),
    );
    const result = await fetchWatchSnapshot("movie", 315846, deps(fetchFn));
    const url = new URL(fetchFn.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/3/movie/315846");
    expect(url.searchParams.get("append_to_response")).toBe("watch/providers");
    expect(result).toEqual({
      providers: [{ name: "Apple TV Store", kind: "rent", link: TW_LINK }],
      link: TW_LINK,
      releaseDate: "2015-06-13",
    });
  });

  it("影集：tv/{id}/watch/providers，releaseDate 為 null", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ results: { TW: { link: "T", flatrate: [{ provider_name: "Netflix", display_priority: 0 }] } } }),
    );
    const result = await fetchWatchSnapshot("series", 93405, deps(fetchFn));
    expect(new URL(fetchFn.mock.calls[0][0] as string).pathname).toBe("/3/tv/93405/watch/providers");
    expect(result).toEqual({
      providers: [{ name: "Netflix", kind: "subscription", link: "T" }],
      link: "T",
      releaseDate: null,
    });
  });

  it("TMDB 非 2xx → 丟 TmdbError", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(fetchWatchSnapshot("movie", 1, deps(fetchFn))).rejects.toMatchObject({
      name: "TmdbError",
      status: 503,
    });
  });
});

describe("parseStoredSnapshot", () => {
  it("合法 jsonb 原樣還原；壞列略過；非物件回 null", () => {
    expect(
      parseStoredSnapshot({
        providers: [
          { name: "Netflix", kind: "subscription", link: "L" },
          { name: "X", kind: "free", link: "L" },
          "bad",
        ],
        link: "L",
        releaseDate: "2026-09-01",
      }),
    ).toEqual({ providers: [{ name: "Netflix", kind: "subscription", link: "L" }], link: "L", releaseDate: "2026-09-01" });
    expect(parseStoredSnapshot(null)).toBeNull();
    expect(parseStoredSnapshot({ providers: "x" })).toBeNull();
  });
});
