/**
 * 既有沒圖的 Podcast 作品補封面（worker 每輪呼叫 /api/works/covers/refresh）：
 * itunes_id → iTunes lookup 600；沒有就讀節目 RSS 的 itunes:image。
 * 確定兩邊都沒圖 → 記 cover_checked_at，7 天後再試；上游失敗不記（下一輪重試）並推警報，不靜默。
 */

import type { Notify } from "../../../worker/notify";
import { pickPodcastCover } from "./cover";

export const COVER_BACKFILL_LIMIT = 10;
const RETRY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PendingCover {
  id: string;
  title: string;
  itunesId: number | null;
  feedUrl: string | null;
}

export interface CoverBackfillDeps {
  /** poster_url 為空、cover_checked_at 為空或早於 retryBefore 的 podcast 作品 */
  listPending: (limit: number, retryBefore: string) => Promise<PendingCover[]>;
  lookupArtwork: (itunesId: number) => Promise<string | null>;
  feedImage: (feedUrl: string) => Promise<string | null>;
  /** 只補空的 poster_url */
  save: (workId: string, url: string) => Promise<void>;
  markChecked: (workId: string) => Promise<void>;
  notify: Notify;
}

export interface CoverBackfillResult {
  scanned: number;
  filled: number;
  missing: number;
  failed: number;
  errors: string[];
}

type Outcome = "filled" | "missing" | "failed";

export function coverRetryBefore(now: Date): string {
  return new Date(now.getTime() - RETRY_DAYS * DAY_MS).toISOString();
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 同一輪內同一個 key 只打一次上游（同節目多集共用封面） */
function memo<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const seen = new Map<K, Promise<V>>();
  return (key) => {
    const hit = seen.get(key);
    if (hit) return hit;
    const pending = load(key);
    seen.set(key, pending);
    return pending;
  };
}

async function attempt<T>(load: () => Promise<T | null>, errors: string[], label: string): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    errors.push(`${label}：${message(error)}`);
    return null;
  }
}

async function backfillOne(
  work: PendingCover,
  deps: CoverBackfillDeps,
  sources: Pick<CoverBackfillDeps, "lookupArtwork" | "feedImage">,
): Promise<{ outcome: Outcome; errors: string[] }> {
  const errors: string[] = [];
  const { itunesId, feedUrl } = work;
  const artwork = itunesId === null ? null : await attempt(() => sources.lookupArtwork(itunesId), errors, "iTunes");
  const feed = artwork || feedUrl === null ? null : await attempt(() => sources.feedImage(feedUrl), errors, "RSS");
  const url = pickPodcastCover(artwork, feed);
  const detail = `「${work.title}」(${work.id})`;
  if (errors.length > 0) {
    await deps.notify("warn", "Podcast 封面補圖：上游失敗", `${detail} ${errors.join("；")}`);
  }
  if (url) {
    await deps.save(work.id, url);
    return { outcome: "filled", errors: [] };
  }
  if (errors.length > 0) return { outcome: "failed", errors: errors.map((line) => `${detail} ${line}`) };
  await deps.markChecked(work.id);
  return { outcome: "missing", errors: [] };
}

export async function runCoverBackfill(
  deps: CoverBackfillDeps,
  now: Date,
  limit = COVER_BACKFILL_LIMIT,
): Promise<CoverBackfillResult> {
  const pending = await deps.listPending(limit, coverRetryBefore(now));
  const sources = { lookupArtwork: memo(deps.lookupArtwork), feedImage: memo(deps.feedImage) };
  let result: CoverBackfillResult = { scanned: pending.length, filled: 0, missing: 0, failed: 0, errors: [] };
  for (const work of pending) {
    let step: { outcome: Outcome; errors: string[] };
    try {
      step = await backfillOne(work, deps, sources);
    } catch (error) {
      step = { outcome: "failed", errors: [`「${work.title}」(${work.id}) 寫回失敗：${message(error)}`] };
    }
    result = { ...result, [step.outcome]: result[step.outcome] + 1, errors: [...result.errors, ...step.errors] };
  }
  return result;
}
