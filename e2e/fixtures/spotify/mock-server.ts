/**
 * 假 Spotify Web API（spotify-auto E2E 用）：client credentials 權杖＋搜尋專輯／節目，記下每個請求讓 spec 斷言。
 * 伺服器經 mock-router 打進來（SPOTIFY_API_BASE＝<router>/spotify/v1、SPOTIFY_ACCOUNTS_BASE＝<router>/spotify-accounts）；
 * 這支沒起時 router 回假權杖＋空結果，所以其他 spec 建音樂／Podcast 作品也不會真打 Spotify。
 */

import { createServer, type Server } from "node:http";

export const SPOTIFY_MOCK_PORT = Number(process.env.E2E_SPOTIFY_MOCK_PORT ?? 3269);

export interface MockSpotifyAlbum {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  total_tracks: number;
  artists: string[];
}

export interface MockSpotifyShow {
  id: string;
  name: string;
  description: string;
}

export interface SpotifyMockData {
  albums: MockSpotifyAlbum[];
  shows: MockSpotifyShow[];
  /** 搜尋一律回 429 QUOTA_EXCEEDED（測警報） */
  quotaExceeded?: boolean;
}

export interface SpotifyMock {
  hits: string[];
  close: () => Promise<void>;
}

function albumItem(album: MockSpotifyAlbum) {
  return { ...album, type: "album", artists: album.artists.map((name) => ({ name, type: "artist" })) };
}

export async function startSpotifyMock(data: SpotifyMockData): Promise<SpotifyMock> {
  const hits: string[] = [];
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${SPOTIFY_MOCK_PORT}`);
    hits.push(`${request.method} ${url.pathname}${url.search}`);
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { "Content-Type": "application/json", ...headers });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/spotify-accounts/api/token" && request.method === "POST") {
      return json(200, { access_token: "e2e-spotify-token", token_type: "Bearer", expires_in: 3600 });
    }
    if (url.pathname === "/spotify/v1/search") {
      if (data.quotaExceeded) {
        return json(429, { error: { status: 429, message: "quota", reason: "QUOTA_EXCEEDED" } }, { "Retry-After": "1" });
      }
      const q = url.searchParams.get("q") ?? "";
      if (url.searchParams.get("type") === "show") {
        return json(200, { shows: { items: data.shows.filter((show) => q.includes(show.name) || show.name.includes(q)) } });
      }
      return json(200, { albums: { items: data.albums.filter((album) => q.includes(album.name)).map(albumItem) } });
    }
    json(404, { error: "not found" });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(SPOTIFY_MOCK_PORT, "127.0.0.1", () => resolve());
  });
  return { hits, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
