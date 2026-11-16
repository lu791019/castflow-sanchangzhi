import { describe, expect, it } from "vitest";
import type { ScreenResult } from "@/lib/work-picker/types";
import { candidateQuery, rankCandidates } from "./candidates";

const screen = (tmdbId: number, year: number | null, title = `片${tmdbId}`): ScreenResult => ({
  kind: "movie",
  tmdbId,
  title,
  originalTitle: null,
  year,
  region: null,
  posterUrl: null,
  releaseDate: null,
  feelingCount: 0,
});

describe("rankCandidates", () => {
  it("年份相同排前面、差一年其次，其餘照搜尋順序；取前 3", () => {
    const results = [screen(1, 1994), screen(2, 2016), screen(3, 2015), screen(4, null), screen(5, 2015)];
    expect(rankCandidates(results, { year: 2015 }).map((item) => item.tmdbId)).toEqual([3, 5, 2]);
  });

  it("沒有年份 → 照搜尋順序前 3", () => {
    const results = [screen(1, 1994), screen(2, 2016), screen(3, 2015), screen(4, 2001)];
    expect(rankCandidates(results, { year: null }).map((item) => item.tmdbId)).toEqual([1, 2, 3]);
  });

  it("不改動傳入的陣列", () => {
    const results = [screen(1, 1994), screen(2, 2015)];
    rankCandidates(results, { year: 2015 });
    expect(results.map((item) => item.tmdbId)).toEqual([1, 2]);
  });
});

describe("candidateQuery", () => {
  it("電影、影集用中文名（沒有就原文名）搜尋", () => {
    expect(candidateQuery({ title: "師父", originalTitle: "The Final Master", kind: "movie", year: 2015 })).toEqual({
      kind: "movie",
      query: "師父",
    });
    expect(candidateQuery({ title: null, originalTitle: null, kind: "unknown", year: null })).toBeNull();
    expect(candidateQuery({ title: "黑鏡", originalTitle: null, kind: "series", year: null })).toEqual({ kind: "series", query: "黑鏡" });
  });

  it("Podcast、演出、展覽不自動搜（改手動或場外）", () => {
    expect(candidateQuery({ title: "百靈果", originalTitle: null, kind: "podcast", year: null })).toBeNull();
    expect(candidateQuery({ title: "大港開唱", originalTitle: null, kind: "live", year: 2024 })).toBeNull();
  });
});
