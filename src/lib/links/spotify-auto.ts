/**
 * Spotify 自動直連（Q-64 A②）：建立音樂（專輯）或 Podcast 作品時，用 client credentials 搜尋 Spotify，
 * 有把握是同一個（lib/spotify/match.ts）才寫一筆 work_links（source spotify，正規化網址同 A①），
 * 作品頁「在哪聽」直連與播放器就自動出現。
 * - 讀者貼的（A①）優先：已有 Spotify 連結（不論誰補的）就不搜；寫入用 insert-if-absent，不覆蓋任何既有列。
 *   自動寫的以 added_by = SPOTIFY_AUTO_ADDED_BY 分辨，讀者之後貼的可以蓋掉它（input.ts decideUserLinkWrite）。
 * - Podcast：同節目（feed_url）別集已有節目直連就沿用，不再搜（省配額）。
 * - 失敗（含 429 配額用完）不擋建立作品：只回 failed 並寫 warn；429 推警報（冷卻中略過的不重推）。不靜默降級。
 * 依賴注入，純流程可測；接線在 spotify-auto-repository.ts。補跑腳本（scripts/spotify-backfill.ts）用 node 直接跑：
 * 執行期 import 只能用相對路徑＋.ts（型別 import 會被拿掉，不受限）。
 */

import type { WorkKind } from "@/lib/works/format";
import { SpotifyApiError } from "../spotify/api.ts";
import { matchAlbum, matchShow, type SpotifyAlbumCandidate, type SpotifyShowCandidate } from "../spotify/match.ts";
import { musicQuery } from "./music-links.ts";
import { parseSpotifyUrl, spotifyUrl } from "./spotify.ts";

export interface AutoLinkWork {
  id: string;
  kind: WorkKind;
  title: string;
  credit: string | null;
  podcast_show: string | null;
  feed_url: string | null;
  /** 建立當下 iTunes lookup 的曲目數（分辨同名單曲／專輯）；補跑既有作品時沒有 */
  trackCount?: number | null;
}

export type AutoLinkOutcome =
  | { status: "linked"; url: string; via: "search" | "same_feed"; name: string }
  | { status: "exists" }
  | { status: "no_match"; candidates: number }
  | { status: "skipped"; reason: "unsupported_kind" | "no_query" | "not_configured" }
  | { status: "failed"; error: string };

export type AutoLinkPlan =
  | { status: "match"; url: string; via: "search" | "same_feed"; name: string }
  | { status: "no_match"; candidates: number }
  | { status: "skipped"; reason: "unsupported_kind" | "no_query" };

export interface AutoLinkSearchDeps {
  searchAlbums: (query: string) => Promise<SpotifyAlbumCandidate[]>;
  searchShows: (query: string) => Promise<SpotifyShowCandidate[]>;
  /** 同 feed_url 的其他集已有的 Spotify 節目直連（沒有回 null） */
  findFeedShowUrl: (feedUrl: string, excludeWorkId: string) => Promise<string | null>;
}

export interface AutoLinkDeps extends AutoLinkSearchDeps {
  hasSpotifyLink: (workId: string) => Promise<boolean>;
  /** insert-if-absent；回 true＝這次寫進去，false＝已有人先寫（讀者或另一個請求） */
  saveAutoLink: (workId: string, url: string) => Promise<boolean>;
  warn: (title: string, detail: string) => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function planAlbum(work: AutoLinkWork, deps: AutoLinkSearchDeps): Promise<AutoLinkPlan> {
  if (!work.title.trim() || !work.credit?.trim()) return { status: "skipped", reason: "no_query" };
  const candidates = await deps.searchAlbums(musicQuery(work));
  const hit = matchAlbum({ title: work.title, credit: work.credit, trackCount: work.trackCount }, candidates);
  return hit
    ? { status: "match", url: spotifyUrl({ type: "album", id: hit.id }), via: "search", name: `${hit.name} — ${hit.artists.join(", ")}` }
    : { status: "no_match", candidates: candidates.length };
}

async function planShow(work: AutoLinkWork, deps: AutoLinkSearchDeps): Promise<AutoLinkPlan> {
  const show = work.podcast_show?.trim();
  if (!show) return { status: "skipped", reason: "no_query" };
  if (work.feed_url) {
    const reused = await deps.findFeedShowUrl(work.feed_url, work.id);
    const parsed = reused ? parseSpotifyUrl(reused) : null;
    if (parsed?.ok && parsed.ref.type === "show") return { status: "match", url: spotifyUrl(parsed.ref), via: "same_feed", name: show };
  }
  const candidates = await deps.searchShows(show);
  const hit = matchShow({ show, credit: work.credit }, candidates);
  return hit
    ? { status: "match", url: spotifyUrl({ type: "show", id: hit.id }), via: "search", name: hit.name }
    : { status: "no_match", candidates: candidates.length };
}

/** 只比對、不寫：建立後的自動直連與補跑腳本（乾跑）共用 */
export async function planSpotifyAutoLink(work: AutoLinkWork, deps: AutoLinkSearchDeps): Promise<AutoLinkPlan> {
  if (work.kind === "music") return planAlbum(work, deps);
  if (work.kind === "podcast_episode") return planShow(work, deps);
  return { status: "skipped", reason: "unsupported_kind" };
}

function failureTitle(error: unknown): string {
  if (error instanceof SpotifyApiError && error.rateLimited) {
    return error.quotaExceeded ? "Spotify 配額用完（QUOTA_EXCEEDED），自動直連暫停" : "Spotify 限流（429），自動直連暫停";
  }
  return "Spotify 自動直連失敗（作品照常建立，保留搜尋連結）";
}

/** 建立作品後呼叫：不丟例外，失敗回 failed 並 warn（429 由 warn 推外部警報；冷卻中略過的只寫 log） */
export async function autoLinkSpotify(work: AutoLinkWork, deps: AutoLinkDeps): Promise<AutoLinkOutcome> {
  if (work.kind !== "music" && work.kind !== "podcast_episode") return { status: "skipped", reason: "unsupported_kind" };
  try {
    if (await deps.hasSpotifyLink(work.id)) return { status: "exists" };
    const plan = await planSpotifyAutoLink(work, deps);
    if (plan.status !== "match") return plan;
    const saved = await deps.saveAutoLink(work.id, plan.url);
    return saved ? { status: "linked", url: plan.url, via: plan.via, name: plan.name } : { status: "exists" };
  } catch (error) {
    const detail = `work=${work.id} kind=${work.kind}：${message(error)}`;
    if (error instanceof SpotifyApiError && error.cooling) {
      console.warn(`[spotify-auto] ${detail}`);
    } else {
      deps.warn(failureTitle(error), detail);
    }
    return { status: "failed", error: message(error) };
  }
}
