import { describe, expect, it, vi } from "vitest";
import {
  TmdbError,
  extractCreators,
  extractDirector,
  fetchTmdbDetail,
  normalizeMovie,
  normalizeTv,
  regionLabel,
  searchTmdb,
  tmdbPosterUrl,
  yearOf,
} from "./tmdb";

const movieRaw = {
  id: 331482,
  title: "海街日記",
  original_title: "海街diary",
  release_date: "2015-06-13",
  poster_path: "/abc.jpg",
};

const tvRaw = {
  id: 65332,
  name: "請回答 1988",
  original_name: "응답하라 1988",
  first_air_date: "2015-11-06",
  poster_path: null,
  origin_country: ["KR"],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("helpers", () => {
  it("yearOf 取日期前 4 碼；空或怪值 null", () => {
    expect(yearOf("2015-06-13")).toBe(2015);
    expect(yearOf("")).toBeNull();
    expect(yearOf(undefined)).toBeNull();
    expect(yearOf("abcd")).toBeNull();
  });
  it("tmdbPosterUrl 用 w185；無 path 回 null", () => {
    expect(tmdbPosterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w185/abc.jpg");
    expect(tmdbPosterUrl(null)).toBeNull();
  });
  it("regionLabel 常見國碼轉中文，未知保留原碼，空陣列 null", () => {
    expect(regionLabel(["JP"])).toBe("日本");
    expect(regionLabel(["KR", "US"])).toBe("韓國");
    expect(regionLabel(["ZZ"])).toBe("ZZ");
    expect(regionLabel([])).toBeNull();
    expect(regionLabel(undefined)).toBeNull();
  });
});

describe("normalizeMovie / normalizeTv", () => {
  it("電影列：title/original/year/poster；原文同片名時 original 為 null", () => {
    expect(normalizeMovie(movieRaw)).toEqual({
      kind: "movie",
      tmdbId: 331482,
      title: "海街日記",
      originalTitle: "海街diary",
      year: 2015,
      region: null,
      posterUrl: "https://image.tmdb.org/t/p/w185/abc.jpg",
      releaseDate: "2015-06-13",
      feelingCount: 0,
    });
    expect(normalizeMovie({ ...movieRaw, original_title: "海街日記" })?.originalTitle).toBeNull();
  });
  it("影集列：name/original_name/first_air_date/origin_country", () => {
    expect(normalizeTv(tvRaw)).toEqual({
      kind: "series",
      tmdbId: 65332,
      title: "請回答 1988",
      originalTitle: "응답하라 1988",
      year: 2015,
      region: "韓國",
      posterUrl: null,
      releaseDate: "2015-11-06",
      feelingCount: 0,
    });
  });
  it("缺 id 或標題的列丟掉", () => {
    expect(normalizeMovie({ title: "x" })).toBeNull();
    expect(normalizeTv({ id: 1 })).toBeNull();
  });
});

describe("extractDirector / extractCreators", () => {
  it("credits.crew 取 job=Director，多位用「、」", () => {
    expect(
      extractDirector({ crew: [{ job: "Writer", name: "A" }, { job: "Director", name: "是枝裕和" }] }),
    ).toBe("是枝裕和");
    expect(
      extractDirector({ crew: [{ job: "Director", name: "A" }, { job: "Director", name: "B" }] }),
    ).toBe("A、B");
    expect(extractDirector({ crew: [] })).toBeNull();
    expect(extractDirector(undefined)).toBeNull();
  });
  it("created_by 取 name", () => {
    expect(extractCreators([{ name: "申源浩" }, { name: "李祐汀" }])).toBe("申源浩、李祐汀");
    expect(extractCreators([])).toBeNull();
  });
});

describe("searchTmdb", () => {
  it("組 zh-TW、include_adult=false 的 URL，Bearer 走 header，回正規化列", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [movieRaw, { id: 2 }] }));
    const results = await searchTmdb("movie", "海街日記", {
      fetch: fetchMock,
      readAccessToken: "tok",
      apiKey: null,
    });
    expect(results).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/search/movie?");
    expect(url).toContain("language=zh-TW");
    expect(url).toContain("include_adult=false");
    expect(url).toContain(`query=${encodeURIComponent("海街日記")}`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
  it("只有 v3 key 時用 api_key query", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    await searchTmdb("series", "請回答", { fetch: fetchMock, readAccessToken: null, apiKey: "k3" });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("/search/tv?");
    expect(url).toContain("api_key=k3");
  });
  it("最多 20 筆", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...movieRaw, id: i + 1 }));
    const fetchMock = vi.fn(async () => jsonResponse({ results: many }));
    const results = await searchTmdb("movie", "海", { fetch: fetchMock, readAccessToken: "t", apiKey: null });
    expect(results).toHaveLength(20);
  });
  it("非 2xx 拋 TmdbError 帶狀態碼；沒 key 也拋", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status_message: "Invalid API key" }, 401));
    await expect(
      searchTmdb("movie", "海街", { fetch: fetchMock, readAccessToken: "t", apiKey: null }),
    ).rejects.toBeInstanceOf(TmdbError);
    await expect(
      searchTmdb("movie", "海街", { fetch: fetchMock, readAccessToken: null, apiKey: null }),
    ).rejects.toThrow(/TMDB_API_KEY/);
  });
});

describe("fetchTmdbDetail", () => {
  it("電影：append credits，導演與製片國家寫入", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...movieRaw,
        production_countries: [{ iso_3166_1: "JP", name: "Japan" }],
        credits: { crew: [{ job: "Director", name: "是枝裕和" }] },
      }),
    );
    const detail = await fetchTmdbDetail("movie", 331482, { fetch: fetchMock, readAccessToken: "t", apiKey: null });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("/movie/331482?");
    expect(url).toContain("append_to_response=credits");
    expect(detail).toEqual({
      kind: "movie",
      tmdbId: 331482,
      title: "海街日記",
      originalTitle: "海街diary",
      year: 2015,
      region: "日本",
      posterUrl: "https://image.tmdb.org/t/p/w185/abc.jpg",
      credit: "是枝裕和",
    });
  });
  it("電影：片長（runtime）帶出供估散場時間；0 或缺值不帶", async () => {
    const withRuntime = vi.fn(async () => jsonResponse({ ...movieRaw, runtime: 128 }));
    const detail = await fetchTmdbDetail("movie", 331482, { fetch: withRuntime, readAccessToken: "t", apiKey: null });
    expect(detail.runtimeMinutes).toBe(128);
    const zero = vi.fn(async () => jsonResponse({ ...movieRaw, runtime: 0 }));
    const noRuntime = await fetchTmdbDetail("movie", 331482, { fetch: zero, readAccessToken: "t", apiKey: null });
    expect(noRuntime).not.toHaveProperty("runtimeMinutes");
  });
  it("影集：created_by 當 credit，不打 credits", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ...tvRaw, created_by: [{ name: "申源浩" }] }));
    const detail = await fetchTmdbDetail("series", 65332, { fetch: fetchMock, readAccessToken: "t", apiKey: null });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("/tv/65332?");
    expect(url).not.toContain("append_to_response");
    expect(detail.credit).toBe("申源浩");
    expect(detail.region).toBe("韓國");
  });
  it("404 → TmdbError(status 404)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404));
    await expect(
      fetchTmdbDetail("movie", 1, { fetch: fetchMock, readAccessToken: "t", apiKey: null }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
