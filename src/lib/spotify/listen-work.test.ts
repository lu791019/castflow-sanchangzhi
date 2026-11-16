import { describe, expect, it, vi } from "vitest";
import type { MusicAlbumResult, PickerWork } from "@/lib/work-picker/types";
import type { SpotifyAlbumDetail } from "./api";
import { isSpotifyAlbumId, matchItunesAlbum, resolveListenWork, type ListenWorkDeps } from "./listen-work";

const ALBUM_ID = "6wlO3VClebIlgMCfBcFbUy";
const SPOTIFY: SpotifyAlbumDetail = { id: ALBUM_ID, name: "帶你飛", album_type: "album", total_tracks: 10, artists: ["告五人"], imageUrl: null };
const WORK = { id: "w1", kind: "music", title: "帶你飛", slug: "music-1" } as unknown as PickerWork;

function itunes(id: number, title: string, artist: string, trackCount: number): MusicAlbumResult {
  return { kind: "music", itunesId: id, title, artist, year: 2023, trackCount, artworkUrl: null, feelingCount: 0 };
}

function makeDeps(overrides: Partial<ListenWorkDeps> = {}): ListenWorkDeps {
  return {
    findLinkedWork: vi.fn(async () => null),
    getAlbum: vi.fn(async () => SPOTIFY),
    searchItunes: vi.fn(async () => [itunes(1, "帶你飛 - Single", "告五人", 1), itunes(2, "帶你飛", "告五人", 10)]),
    createMusicWork: vi.fn(async () => WORK),
    saveAutoLink: vi.fn(async () => true),
    warn: vi.fn(),
    ...overrides,
  };
}

describe("isSpotifyAlbumId", () => {
  it("只收 22 碼 base62", () => {
    expect(isSpotifyAlbumId(ALBUM_ID)).toBe(true);
    expect(isSpotifyAlbumId("short")).toBe(false);
    expect(isSpotifyAlbumId(`${ALBUM_ID}/../x`)).toBe(false);
    expect(isSpotifyAlbumId(null)).toBe(false);
  });
});

describe("matchItunesAlbum（Spotify 專輯 → iTunes 同一張）", () => {
  it("同名同藝人，曲目數分出專輯與單曲", () => {
    expect(matchItunesAlbum(SPOTIFY, [itunes(1, "帶你飛", "告五人", 1), itunes(2, "帶你飛", "告五人", 10)])?.itunesId).toBe(2);
  });
  it("同名不同藝人、譯名 → null", () => {
    expect(matchItunesAlbum(SPOTIFY, [itunes(3, "帶你飛", "別人", 10)])).toBeNull();
    expect(matchItunesAlbum({ ...SPOTIFY, name: "1989", artists: ["Taylor Swift"] }, [itunes(4, "1989", "泰勒絲", 13)])).toBeNull();
  });
});

describe("resolveListenWork", () => {
  it("已有作品掛著這張的 Spotify 直連 → 直接用，不打 Spotify", async () => {
    const deps = makeDeps({ findLinkedWork: vi.fn(async () => WORK) });
    expect(await resolveListenWork(ALBUM_ID, deps)).toBe(WORK);
    expect(deps.findLinkedWork).toHaveBeenCalledWith(`https://open.spotify.com/album/${ALBUM_ID}`);
    expect(deps.getAlbum).not.toHaveBeenCalled();
  });

  it("沒有 → 讀 Spotify 專輯、iTunes 找同一張、建作品並補直連", async () => {
    const deps = makeDeps();
    expect(await resolveListenWork(ALBUM_ID, deps)).toBe(WORK);
    expect(deps.searchItunes).toHaveBeenCalledWith("帶你飛 告五人");
    expect(deps.createMusicWork).toHaveBeenCalledWith(2);
    expect(deps.saveAutoLink).toHaveBeenCalledWith("w1", `https://open.spotify.com/album/${ALBUM_ID}`);
  });

  it("iTunes 沒把握 → null，不建作品", async () => {
    const deps = makeDeps({ searchItunes: vi.fn(async () => [itunes(3, "帶你飛", "別人", 10)]) });
    expect(await resolveListenWork(ALBUM_ID, deps)).toBeNull();
    expect(deps.createMusicWork).not.toHaveBeenCalled();
  });

  it("id 不合法 → null，什麼都不查", async () => {
    const deps = makeDeps();
    expect(await resolveListenWork("../../etc", deps)).toBeNull();
    expect(deps.findLinkedWork).not.toHaveBeenCalled();
  });

  it("任何失敗 → null＋警報（記一筆照常打開）", async () => {
    const deps = makeDeps({ getAlbum: vi.fn(async () => Promise.reject(new Error("HTTP 429"))) });
    expect(await resolveListenWork(ALBUM_ID, deps)).toBeNull();
    expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining("收聽提醒"), expect.stringContaining("HTTP 429"));
  });
});
