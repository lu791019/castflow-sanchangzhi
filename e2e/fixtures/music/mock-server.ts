/**
 * 假 iTunes 專輯搜尋／lookup＋假 Apple Music 熱門專輯榜（music E2E 用），順便給散場之前要的假 Podcast 榜與假文化部。
 * iTunes lookup 只有一個網址（ITUNES_LOOKUP_URL），Podcast 榜與專輯共用：依 id 回對應的那筆。
 * dev server 要帶（正式環境不吃）：
 *   ITUNES_SEARCH_URL=http://127.0.0.1:<port>/itunes/search  ITUNES_LOOKUP_URL=http://127.0.0.1:<port>/itunes/lookup
 *   APPLE_MUSIC_TOP_URL=http://127.0.0.1:<port>/music/top.json  APPLE_TOP_URL=http://127.0.0.1:<port>/apple/top.json
 *   CULTURE_API_BASE=http://127.0.0.1:<port>/culture CULTURE_CACHE_TTL_MS=0
 * 專輯 id 固定（作品 slug＝music-<id>，跑完由 spec 清掉）；榜單在 dev server 快取一小時，所以不帶執行代號。
 */

import { createServer, type Server } from "node:http";

export const MUSIC_MOCK_PORT = Number(process.env.E2E_MUSIC_MOCK_PORT ?? 3267);
const BASE = `http://127.0.0.1:${MUSIC_MOCK_PORT}`;

/** 1×1 燒橙 PNG：專輯封面（方形比例看版位，不看圖） */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export interface MockAlbum {
  id: number;
  name: string;
  artist: string;
  year: number;
  tracks: number;
  artwork: boolean;
}

/** 本週熱門（榜單）：第一張有封面、第二張沒有（字卡） */
export const TOP_ALBUMS: MockAlbum[] = [
  { id: 9900001, name: "散場測試・夜車 - EP", artist: "測試樂團", year: 2026, tracks: 6, artwork: true },
  { id: 9900002, name: "散場測試・海邊的歌", artist: "測試歌手", year: 2026, tracks: 11, artwork: false },
];

/** 搜「告五人」的結果：一張專輯、一張單曲 */
export const SEARCH_ALBUMS: MockAlbum[] = [
  { id: 9900011, name: "散場測試・帶你飛", artist: "告五人", year: 2023, tracks: 10, artwork: true },
  { id: 9900012, name: "散場測試・披星戴月的想你 - Single", artist: "告五人", year: 2018, tracks: 1, artwork: false },
];

/** Spotify 自動直連（spotify-auto.spec）：只給 lookup（建立作品），不出現在搜尋與榜單 */
export const AUTO_ALBUMS: MockAlbum[] = [
  { id: 9900021, name: "散場測試・自動直連", artist: "測試樂團", year: 2026, tracks: 9, artwork: false },
  { id: 9900022, name: "散場測試・配額用完", artist: "測試樂團", year: 2026, tracks: 8, artwork: false },
];

export const MOCK_PODCAST = { id: 9900101, name: "散場測試電台・音樂", feedPath: "/rss/9900101.xml" };

const artworkUrl = (album: MockAlbum) => (album.artwork ? `${BASE}/img/${album.id}/100x100bb.png` : undefined);

function collection(album: MockAlbum) {
  return {
    wrapperType: "collection",
    collectionType: "Album",
    collectionId: album.id,
    collectionName: album.name,
    artistName: album.artist,
    artworkUrl100: artworkUrl(album),
    trackCount: album.tracks,
    releaseDate: `${album.year}-01-15T08:00:00Z`,
  };
}

function rss(): string {
  const item = (guid: string, title: string, date: string) =>
    `<item><title>${title}</title><guid>${guid}</guid><pubDate>${date}</pubDate><enclosure url="${BASE}/audio/${guid}.mp3" type="audio/mpeg" length="1"/></item>`;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${MOCK_PODCAST.name}</title>${item(
    "e2e-music-ep1",
    "第 1 集",
    "Wed, 01 Oct 2026 12:00:00 GMT",
  )}</channel></rss>`;
}

export interface MusicMock {
  hits: string[];
  close: () => Promise<void>;
}

const ALL_ALBUMS = [...TOP_ALBUMS, ...SEARCH_ALBUMS, ...AUTO_ALBUMS];

function lookupResults(ids: string[]): unknown[] {
  return ids.flatMap((raw): unknown[] => {
    const id = Number(raw);
    if (id === MOCK_PODCAST.id) {
      return [{ collectionId: id, collectionName: MOCK_PODCAST.name, artistName: "測試主持人", trackCount: 1, feedUrl: `${BASE}${MOCK_PODCAST.feedPath}` }];
    }
    const album = ALL_ALBUMS.find((item) => item.id === id);
    return album ? [collection(album)] : [];
  });
}

export async function startMusicMock(): Promise<MusicMock> {
  const hits: string[] = [];
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", BASE);
    hits.push(`${url.pathname}${url.search}`);
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/itunes/search") {
      const term = url.searchParams.get("term") ?? "";
      return json(200, { results: term.includes("告五人") ? SEARCH_ALBUMS.map(collection) : [] });
    }
    if (url.pathname === "/itunes/lookup") return json(200, { results: lookupResults((url.searchParams.get("id") ?? "").split(",")) });
    if (url.pathname === "/music/top.json") {
      return json(200, {
        feed: {
          title: "熱門專輯",
          results: TOP_ALBUMS.map((album) => ({
            id: String(album.id),
            name: album.name,
            artistName: album.artist,
            releaseDate: `${album.year}-09-24`,
            kind: "albums",
            artworkUrl100: artworkUrl(album),
          })),
        },
      });
    }
    if (url.pathname === "/apple/top.json") return json(200, { feed: { results: [{ id: String(MOCK_PODCAST.id), name: MOCK_PODCAST.name }] } });
    if (url.pathname === MOCK_PODCAST.feedPath) {
      response.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
      return response.end(rss());
    }
    if (url.pathname === "/culture") return json(200, []);
    if (url.pathname.startsWith("/img/")) {
      response.writeHead(200, { "Content-Type": "image/png" });
      return response.end(PNG);
    }
    return json(404, { error: "not found" });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(MUSIC_MOCK_PORT, "127.0.0.1", () => resolve());
  });
  return { hits, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
