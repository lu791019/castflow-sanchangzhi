/**
 * 外部服務路由（globalSetup 起、globalTeardown 關）：E2E 伺服器的 TMDB／文化部／Apple 榜／iTunes 網址全指到這一個 port，
 * 由這裡轉給「這支 spec 有起的假 server」；沒起就照下表處理。
 *
 * 為什麼要有：打包後的伺服器只能帶一組 env，但各 spec 用不同的假 server（tmdb-mock 3163、culture 3166、music 3267），
 * 也有 spec 刻意真打外部搜尋（taste、uxlog、work-picker）。
 *
 * | 路徑 | 優先 | 都沒起 |
 * |---|---|---|
 * | /3/movie/99xxxx、/3/tv/99xxxx（假 server 的作品 id） | tmdb-mock | 路由自己回假資料（不拿假 id 去真 TMDB 撈到別部片） |
 * | /3/search/*、/3/movie/<id>、/3/tv/<id>（含子路徑） | tmdb-mock | 真 TMDB（原樣轉發，認證 header／query 照帶） |
 * | /3/其他（上映、熱門清單） | tmdb-mock | 503；spec 呼叫 useRealTrending(true) 時改真 TMDB |
 * | /itunes/search | music mock | 真 iTunes |
 * | /itunes/lookup | music mock → culture mock（/apple/lookup） | 真 iTunes |
 * | /apple/top.json、/music/top.json | culture mock → music mock | 503；useRealTrending(true) 時改真 Apple 榜 |
 * | /culture | culture mock → music mock | 503 |
 * | /spotify/v1/*、/spotify-accounts/* | spotify mock | 路由自己回假權杖＋空搜尋結果（永遠不真打 Spotify） |
 *
 * 榜單 503 是預設：等同假 server 沒開，真資料不會混進只認假資料的 spec。伺服器的本週熱門快取由 TRENDING_CACHE_TTL_MS=0 關掉，
 * 每支 spec 拿到的都是當下的來源；但重抓失敗時伺服器會回上一次的榜單（降級設計），所以前一支 spec 的假電影卡會留著，
 * 它們的詳情由路由自己回（tmdbMockBody），點下去照樣能排進行程。
 */

import { createServer, type IncomingMessage, type Server } from "node:http";
import { CULTURE_MOCK_PORT } from "./culture/mock-server";
import { MUSIC_MOCK_PORT } from "./music/mock-server";
import { SPOTIFY_MOCK_PORT } from "./spotify/mock-server";
import { TMDB_MOCK_PORT, tmdbMockBody } from "./tmdb-mock";

export const MOCK_ROUTER_PORT = Number(process.env.E2E_MOCK_ROUTER_PORT ?? 3160);
export const MOCK_ROUTER_BASE = `http://127.0.0.1:${MOCK_ROUTER_PORT}`;

const REAL_TMDB = "https://api.themoviedb.org";
const REAL_ITUNES = "https://itunes.apple.com";
/** 與 src/lib/trending/apple-top.ts、apple-music-top.ts 的正式網址相同 */
const REAL_APPLE_TOP = "https://rss.marketingtools.apple.com/api/v2/tw/podcasts/top/30/podcasts.json";
const REAL_APPLE_MUSIC_TOP = "https://rss.marketingtools.apple.com/api/v2/tw/music/most-played/25/albums.json";
const CONTROL_PATH = "/__e2e/real-trending";
const UPSTREAM_TIMEOUT_MS = 20_000;
/** 轉發時不帶的 hop-by-hop header */
const DROPPED_HEADERS = new Set(["host", "connection", "content-length", "transfer-encoding", "accept-encoding"]);

/** 伺服器（e2e/server.ts）要帶的外部服務網址 env */
export function mockRouterEnv(): Record<string, string> {
  return {
    E2E_EXTERNAL_MOCKS: "on",
    TMDB_API_BASE: `${MOCK_ROUTER_BASE}/3`,
    CULTURE_API_BASE: `${MOCK_ROUTER_BASE}/culture`,
    CULTURE_CACHE_TTL_MS: "0",
    TRENDING_CACHE_TTL_MS: "0",
    APPLE_TOP_URL: `${MOCK_ROUTER_BASE}/apple/top.json`,
    APPLE_MUSIC_TOP_URL: `${MOCK_ROUTER_BASE}/music/top.json`,
    ITUNES_SEARCH_URL: `${MOCK_ROUTER_BASE}/itunes/search`,
    ITUNES_LOOKUP_URL: `${MOCK_ROUTER_BASE}/itunes/lookup`,
    SPOTIFY_API_BASE: `${MOCK_ROUTER_BASE}/spotify/v1`,
    SPOTIFY_ACCOUNTS_BASE: `${MOCK_ROUTER_BASE}/spotify-accounts`,
  };
}

/** spotify mock 沒起時：假權杖、空搜尋結果（建音樂／Podcast 作品後的自動直連就是「沒把握」，不寫） */
export function spotifyFallbackBody(pathname: string): unknown {
  if (pathname === "/spotify-accounts/api/token") return { access_token: "e2e-router-token", token_type: "Bearer", expires_in: 3600 };
  if (pathname === "/spotify/v1/search") return { albums: { items: [] }, shows: { items: [] } };
  return null;
}

interface Target {
  /** 依序嘗試的完整網址；本機假 server 連不上（沒起）就換下一個 */
  candidates: string[];
  /** 候選都沒起時由路由自己回的內容 */
  fallback?: () => unknown;
}

const local = (port: number, path: string) => `http://127.0.0.1:${port}${path}`;
const TMDB_MOCK_ID_PATH = /^\/3\/(movie|tv)\/99\d{4}(\/|$)/;
const TMDB_REAL_PATH = /^\/3\/(search\/|movie\/\d+|tv\/\d+)/;

/** realTrending：上映／熱門清單與榜單在假 server 沒起時是否改真打（work-picker 的「本週熱門」要真資料） */
export function routeFor(pathname: string, search: string, realTrending = false): Target | null {
  const tail = `${pathname}${search}`;
  if (pathname.startsWith("/3/")) {
    const mock = local(TMDB_MOCK_PORT, tail);
    if (TMDB_MOCK_ID_PATH.test(pathname)) return { candidates: [mock], fallback: () => tmdbMockBody(pathname) };
    const real = TMDB_REAL_PATH.test(pathname) || realTrending;
    return { candidates: [mock, ...(real ? [`${REAL_TMDB}${tail}`] : [])] };
  }
  if (pathname.startsWith("/spotify/") || pathname.startsWith("/spotify-accounts/")) {
    return { candidates: [local(SPOTIFY_MOCK_PORT, tail)], fallback: () => spotifyFallbackBody(pathname) };
  }
  if (pathname === "/itunes/search") return { candidates: [local(MUSIC_MOCK_PORT, tail), `${REAL_ITUNES}/search${search}`] };
  if (pathname === "/itunes/lookup") {
    return { candidates: [local(MUSIC_MOCK_PORT, tail), local(CULTURE_MOCK_PORT, `/apple/lookup${search}`), `${REAL_ITUNES}/lookup${search}`] };
  }
  const mocks = [local(CULTURE_MOCK_PORT, tail), local(MUSIC_MOCK_PORT, tail)];
  if (pathname === "/apple/top.json") return { candidates: [...mocks, ...(realTrending ? [REAL_APPLE_TOP] : [])] };
  if (pathname === "/music/top.json") return { candidates: [...mocks, ...(realTrending ? [REAL_APPLE_MUSIC_TOP] : [])] };
  if (pathname === "/culture") return { candidates: mocks };
  return null;
}

/** spec 用：這支 spec 期間上映清單與榜單改真打（afterAll 記得關） */
export async function useRealTrending(on: boolean): Promise<void> {
  const response = await fetch(`${MOCK_ROUTER_BASE}${CONTROL_PATH}?on=${on ? "1" : "0"}`, { method: "POST" });
  if (!response.ok) throw new Error(`[e2e mock-router] 切換真榜單失敗 → ${response.status}`);
}

function isLocalRefused(url: string, error: unknown): boolean {
  if (!url.startsWith("http://127.0.0.1:")) return false;
  const cause = (error as { cause?: { code?: string } } | null)?.cause;
  return cause?.code === "ECONNREFUSED";
}

function forwardHeaders(request: IncomingMessage): Record<string, string> {
  return Object.fromEntries(
    Object.entries(request.headers).flatMap(([name, value]) =>
      DROPPED_HEADERS.has(name) || value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : value]],
    ),
  );
}

async function readBody(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

/** 依序打候選網址：本機假 server 沒起就換下一個；回傳 null＝全部沒起 */
async function fetchFirst(target: Target, init: RequestInit): Promise<Response | null> {
  for (const url of target.candidates) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch (error) {
      if (isLocalRefused(url, error)) continue;
      throw error;
    }
  }
  return null;
}

export interface MockRouter {
  close: () => Promise<void>;
}

export async function startMockRouter(): Promise<MockRouter> {
  let realTrending = false;
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", MOCK_ROUTER_BASE);
    const reply = (status: number, body: string) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: body }));
    };
    if (url.pathname === CONTROL_PATH && request.method === "POST") {
      realTrending = url.searchParams.get("on") === "1";
      return reply(200, realTrending ? "real trending on" : "real trending off");
    }
    const target = routeFor(url.pathname, url.search, realTrending);
    if (!target) return reply(404, "not routed");
    void (async () => {
      try {
        const upstream = await fetchFirst(target, { method: request.method, headers: forwardHeaders(request), body: await readBody(request) });
        if (!upstream) {
          const body = target.fallback?.();
          if (!body) return reply(503, "mock not running");
          response.writeHead(200, { "Content-Type": "application/json" });
          return response.end(JSON.stringify(body));
        }
        const body = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream" });
        response.end(body);
      } catch (error) {
        reply(502, error instanceof Error ? error.message : String(error));
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(MOCK_ROUTER_PORT, "127.0.0.1", () => resolve());
  });
  return {
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
