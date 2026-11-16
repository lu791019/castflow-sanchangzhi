/**
 * Spotify 自動直連（Q-64 A②）的接線（server only，service role）：env → Spotify 用戶端、work_links 讀寫、警報。
 * 建立作品後用 after() 在回應送出後才搜（不拖慢建立、失敗也不影響建立）。
 * 沒設 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET：每個 process 推一次警報，之後略過（不靜默）。
 */

import { after } from "next/server";
import { getServerNotify } from "@/lib/alerts/notify";
import {
  createSpotifyAppState,
  searchSpotifyAlbums,
  searchSpotifyShows,
  spotifyCredentialsFromEnv,
  spotifyUrlsFromEnv,
  type SpotifyAppDeps,
} from "@/lib/spotify/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { SPOTIFY_AUTO_ADDED_BY, SPOTIFY_LABEL, SPOTIFY_SOURCE } from "./spotify";
import { autoLinkSpotify, type AutoLinkDeps, type AutoLinkOutcome, type AutoLinkSearchDeps, type AutoLinkWork } from "./spotify-auto";

/** 同一個 process 共用一份權杖快取與 429 冷卻 */
const sharedState = createSpotifyAppState();
let missingCredentialsWarned = false;

function warn(title: string, detail: string): void {
  console.error(`[spotify-auto] ${title}`, detail);
  void getServerNotify()("warn", title, detail).catch(() => undefined);
}

function warnMissingCredentialsOnce(): void {
  if (missingCredentialsWarned) return;
  missingCredentialsWarned = true;
  warn("Spotify 自動直連停用：沒有 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET", "新建的音樂、Podcast 作品先只有搜尋連結；設好 env 後自動恢復");
}

export function spotifyAppDepsFromEnv(): SpotifyAppDeps | null {
  const credentials = spotifyCredentialsFromEnv();
  if (!credentials) return null;
  return { fetch, credentials, urls: spotifyUrlsFromEnv(), state: sharedState };
}

/** 這個作品已有 Spotify 連結（任何狀態、任何人補的）→ 不搜 */
async function hasSpotifyLink(workId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("work_links")
    .select("id")
    .eq("work_id", workId)
    .eq("source", SPOTIFY_SOURCE)
    .limit(1);
  if (error) throw new Error(`讀取既有 Spotify 連結失敗：${error.message}`);
  return (data ?? []).length > 0;
}

/** 同節目（feed_url）別集已有的 Spotify 直連；呼叫端只收 show 類型 */
async function findFeedShowUrl(feedUrl: string, excludeWorkId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("work_links")
    .select("url, works!inner(feed_url)")
    .eq("works.feed_url", feedUrl)
    .eq("source", SPOTIFY_SOURCE)
    .eq("status", "active")
    .neq("work_id", excludeWorkId)
    .like("url", "https://open.spotify.com/show/%")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`讀取同節目 Spotify 連結失敗：${error.message}`);
  const row = (data ?? [])[0] as { url: string } | undefined;
  return row?.url ?? null;
}

/** insert-if-absent：(work_id, source) 已有任何一列就不動（讀者貼的優先） */
export async function saveAutoLink(workId: string, url: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("work_links")
    .upsert(
      {
        work_id: workId,
        kind: "watch",
        source: SPOTIFY_SOURCE,
        label: SPOTIFY_LABEL,
        url,
        origin: "curated",
        status: "active",
        added_by: SPOTIFY_AUTO_ADDED_BY,
      },
      { onConflict: "work_id,source", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`寫入 Spotify 自動直連失敗：${error.message}`);
  return (data ?? []).length > 0;
}

export function autoLinkSearchDeps(app: SpotifyAppDeps): AutoLinkSearchDeps {
  return {
    searchAlbums: (query) => searchSpotifyAlbums(query, app),
    searchShows: (query) => searchSpotifyShows(query, app),
    findFeedShowUrl,
  };
}

export function autoLinkDeps(app: SpotifyAppDeps): AutoLinkDeps {
  return { ...autoLinkSearchDeps(app), hasSpotifyLink, saveAutoLink, warn };
}

/** 立即跑一次（補跑腳本、測試用）；沒設金鑰回 skipped */
export async function runSpotifyAutoLink(work: AutoLinkWork): Promise<AutoLinkOutcome> {
  const app = spotifyAppDepsFromEnv();
  if (!app) {
    warnMissingCredentialsOnce();
    return { status: "skipped", reason: "not_configured" };
  }
  const outcome = await autoLinkSpotify(work, autoLinkDeps(app));
  if (outcome.status === "linked") console.info(`[spotify-auto] work=${work.id} → ${outcome.url}（${outcome.via}）`);
  return outcome;
}

/** 建立作品後呼叫：回應送出後才搜，不擋建立 */
export function scheduleSpotifyAutoLink(work: AutoLinkWork): void {
  if (work.kind !== "music" && work.kind !== "podcast_episode") return;
  after(async () => {
    await runSpotifyAutoLink(work);
  });
}
