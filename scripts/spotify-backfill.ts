/**
 * 既有音樂／Podcast 作品補跑 Spotify 自動直連（Q-64 A②，service role＋Spotify client credentials）：
 *   npm run spotify:backfill                          乾跑（預設）：只印比對結果，不寫 DB；最多 20 組
 *   npm run spotify:backfill -- --limit 50            最多 50 組（Podcast 同節目算一組、只搜一次）
 *   npm run spotify:backfill -- --kind music          只跑音樂（podcast／all）
 *   npm run spotify:backfill -- --write               真的寫入（insert-if-absent，不覆蓋讀者貼的；added_by system:spotify-search）
 * 每組間隔 400ms；遇到 429（配額用完）立刻停，印出已處理的組數。
 * env：repo 根 .env.development.local 優先，再 .env.local；已存在的環境變數不被覆蓋。不印任何金鑰或權杖。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  createSpotifyAppState,
  searchSpotifyAlbums,
  searchSpotifyShows,
  SpotifyApiError,
  spotifyCredentialsFromEnv,
  SPOTIFY_ACCOUNTS_BASE,
  SPOTIFY_API_BASE,
  type SpotifyAppDeps,
} from "../src/lib/spotify/api.ts";
import { SPOTIFY_AUTO_ADDED_BY, SPOTIFY_LABEL, SPOTIFY_SOURCE } from "../src/lib/links/spotify.ts";
import { planSpotifyAutoLink, type AutoLinkPlan } from "../src/lib/links/spotify-auto.ts";
import {
  BACKFILL_MAX_LIMIT,
  describePlan,
  parseBackfillArgs,
  selectBackfillTargets,
  type BackfillWorkRow,
} from "../src/lib/links/spotify-backfill.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(repoRoot, envFile));
  } catch {
    // 檔案不存在就跳過
  }
}

const PACE_MS = 400;
/** 撈作品的上限（每組最多 limit，但要先把同節目各集都撈齊） */
const WORK_SCAN_MAX = BACKFILL_MAX_LIMIT * 20;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少環境變數 ${name}`);
  return value;
}

const parsed = parseBackfillArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}
const args = parsed.value;
const credentials = spotifyCredentialsFromEnv();
if (!credentials) throw new Error("缺少 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET");

const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
// 腳本一律打正式 Spotify（不吃 E2E 網址覆寫）
const app: SpotifyAppDeps = {
  fetch,
  credentials,
  urls: { apiBase: SPOTIFY_API_BASE, accountsBase: SPOTIFY_ACCOUNTS_BASE },
  state: createSpotifyAppState(),
};

async function loadWorks(): Promise<BackfillWorkRow[]> {
  const { data, error } = await db
    .from("works")
    .select("id, kind, slug, title, credit, podcast_show, feed_url")
    .in("kind", ["music", "podcast_episode"])
    .order("created_at", { ascending: true })
    .limit(WORK_SCAN_MAX);
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  return (data ?? []) as BackfillWorkRow[];
}

/** 已有 Spotify 連結的作品，以及各節目已有的 show 直連（同節目沿用） */
async function loadLinked(): Promise<{ ids: Set<string>; showByFeed: Map<string, string> }> {
  const { data, error } = await db.from("work_links").select("work_id, url, status, works!inner(feed_url)").eq("source", SPOTIFY_SOURCE);
  if (error) throw new Error(`讀取既有 Spotify 連結失敗：${error.message}`);
  const rows = (data ?? []) as unknown as Array<{ work_id: string; url: string; status: string; works: { feed_url: string | null } }>;
  const showByFeed = new Map(
    rows
      .filter((row) => row.status === "active" && row.works.feed_url && row.url.startsWith("https://open.spotify.com/show/"))
      .map((row) => [row.works.feed_url as string, row.url]),
  );
  return { ids: new Set(rows.map((row) => row.work_id)), showByFeed };
}

async function writeLinks(workIds: readonly string[], url: string): Promise<number> {
  const rows = workIds.map((workId) => ({
    work_id: workId,
    kind: "watch",
    source: SPOTIFY_SOURCE,
    label: SPOTIFY_LABEL,
    url,
    origin: "curated",
    status: "active",
    added_by: SPOTIFY_AUTO_ADDED_BY,
  }));
  const { data, error } = await db.from("work_links").upsert(rows, { onConflict: "work_id,source", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`寫入失敗：${error.message}`);
  return (data ?? []).length;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const [works, linked] = await Promise.all([loadWorks(), loadLinked()]);
  const targets = selectBackfillTargets(works, linked.ids, args);
  console.log(`${args.write ? "寫入模式" : "乾跑（不寫 DB）"}：作品 ${works.length}、已有 Spotify ${linked.ids.size}、這次 ${targets.length} 組`);
  let matched = 0;
  let written = 0;
  for (const [index, target] of targets.entries()) {
    let plan: AutoLinkPlan;
    try {
      plan = await planSpotifyAutoLink(target.work, {
        searchAlbums: (query) => searchSpotifyAlbums(query, app),
        searchShows: (query) => searchSpotifyShows(query, app),
        findFeedShowUrl: async (feedUrl) => linked.showByFeed.get(feedUrl) ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(describePlan(target, { status: "failed", error: message }));
      if (error instanceof SpotifyApiError && error.rateLimited) {
        console.error(`Spotify 429，停在第 ${index + 1}/${targets.length} 組；稍後再跑（已寫入的不會重搜）`);
        break;
      }
      continue;
    }
    console.log(describePlan(target, plan));
    if (plan.status === "match") {
      matched += 1;
      if (args.write) written += await writeLinks(target.workIds, plan.url);
    }
    await sleep(PACE_MS);
  }
  console.log(`配到 ${matched}／${targets.length} 組${args.write ? `，寫入 ${written} 筆` : "（乾跑，沒有寫入；確認後加 --write）"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
