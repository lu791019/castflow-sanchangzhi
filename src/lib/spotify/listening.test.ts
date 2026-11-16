import { describe, expect, it } from "vitest";
import { finishedAlbums, listenDedupeKey, listenPrompt, taipeiDay, tracksNeeded, DEFAULT_LISTEN_RULE } from "./listening";
import type { RecentPlay } from "./user-api";

const NOW = new Date("2026-10-16T12:00:00Z"); // 台北 20:00

function play(albumId: string, trackId: string, minutesAgo: number, album: Partial<RecentPlay["album"]> = {}): RecentPlay {
  return {
    playedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    trackId,
    album: { id: albumId, name: `專輯${albumId}`, albumType: "album", totalTracks: 10, artists: ["告五人"], imageUrl: null, ...album },
  };
}

function tracks(albumId: string, count: number, startMinutesAgo = 60, album: Partial<RecentPlay["album"]> = {}): RecentPlay[] {
  return Array.from({ length: count }, (_, index) => play(albumId, `${albumId}-t${index}`, startMinutesAgo - index * 4, album));
}

describe("tracksNeeded", () => {
  it("過半、至少 3 首、最多要求 8 首", () => {
    expect(tracksNeeded("album", 10)).toBe(5);
    expect(tracksNeeded("album", 11)).toBe(6);
    expect(tracksNeeded("album", 4)).toBe(3);
    expect(tracksNeeded("album", 30)).toBe(8);
    expect(tracksNeeded("compilation", 12)).toBe(6);
  });

  it("單曲、總曲目 < 4 不算；總曲目不明要聽滿 8 首", () => {
    expect(tracksNeeded("single", 1)).toBeNull();
    expect(tracksNeeded("single", 6)).toBeNull();
    expect(tracksNeeded("album", 3)).toBeNull();
    expect(tracksNeeded("album", null)).toBe(DEFAULT_LISTEN_RULE.enoughTracks);
  });
});

describe("finishedAlbums", () => {
  it("10 首的專輯聽了 5 首不同的 → 聽完", () => {
    const [album] = finishedAlbums(tracks("A", 5), NOW);
    expect(album).toMatchObject({ albumId: "A", distinctTracks: 5, totalTracks: 10 });
  });

  it("只聽 4 首 → 還沒", () => {
    expect(finishedAlbums(tracks("A", 4), NOW)).toEqual([]);
  });

  it("同一首重複聽只算一首", () => {
    const loops = [0, 1, 2, 3, 4, 5].map((index) => play("A", "same-track", 60 - index * 4));
    expect(finishedAlbums([...loops, ...tracks("A", 2)], NOW)).toEqual([]);
  });

  it("超過 4 小時前聽的不算（前天的不會今天才問）", () => {
    expect(finishedAlbums(tracks("A", 6, 300), NOW)).toEqual([]);
    // 一半在時間窗內、一半在外 → 只算窗內的
    const mixed = [...tracks("A", 3, 300).map((p, i) => ({ ...p, trackId: `old-${i}` })), ...tracks("A", 3, 60)];
    expect(finishedAlbums(mixed, NOW)).toEqual([]);
  });

  it("未來時間（時鐘誤差）不算", () => {
    expect(finishedAlbums(tracks("A", 6, -30), NOW)).toEqual([]);
  });

  it("單曲、EP 太短不問；長專輯聽 8 首就算", () => {
    expect(finishedAlbums(tracks("S", 5, 60, { albumType: "single", totalTracks: 5 }), NOW)).toEqual([]);
    expect(finishedAlbums(tracks("E", 3, 60, { totalTracks: 3 }), NOW)).toEqual([]);
    expect(finishedAlbums(tracks("L", 8, 60, { totalTracks: 30 }), NOW)).toHaveLength(1);
  });

  it("多張專輯：各自判斷，最近聽完的在前", () => {
    const result = finishedAlbums([...tracks("A", 5, 200), ...tracks("B", 6, 60), ...tracks("C", 2, 30)], NOW);
    expect(result.map((album) => album.albumId)).toEqual(["B", "A"]);
  });

  it("lastPlayedAt 是這張最後一首的時間", () => {
    const [album] = finishedAlbums(tracks("A", 5, 60), NOW);
    expect(album.lastPlayedAt).toBe(new Date(NOW.getTime() - (60 - 16) * 60_000).toISOString());
  });
});

describe("提醒內容與去重", () => {
  it("同一張專輯同一天（台北）同一個鍵；跨台北午夜換鍵", () => {
    expect(taipeiDay(new Date("2026-10-16T15:59:00Z"))).toBe("2026-10-16");
    expect(taipeiDay(new Date("2026-10-16T16:00:00Z"))).toBe("2026-10-17");
    expect(listenDedupeKey("A", new Date("2026-10-16T01:00:00Z"))).toBe(listenDedupeKey("A", new Date("2026-10-16T15:00:00Z")));
    expect(listenDedupeKey("A", new Date("2026-10-16T15:00:00Z"))).not.toBe(listenDedupeKey("A", new Date("2026-10-16T17:00:00Z")));
  });

  it("標題問要不要記一筆，連到記一筆並帶專輯 id", () => {
    const [album] = finishedAlbums(tracks("6wlO3VClebIlgMCfBcFbUy", 5, 60, { name: "帶你飛" }), NOW);
    expect(listenPrompt(album, NOW)).toEqual({
      title: "要不要記一筆《帶你飛》？",
      body: "告五人・剛剛聽了 5 首",
      url: "/journal/new?spotifyAlbum=6wlO3VClebIlgMCfBcFbUy",
      dedupeKey: "spotify-album:6wlO3VClebIlgMCfBcFbUy:2026-10-16",
    });
  });
});
