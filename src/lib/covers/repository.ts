/** 封面補齊的資料存取（server only，service role）：podcast 待補清單、只補空的 poster_url、記查過時間 */

import { getServerNotify } from "@/lib/alerts/notify";
import { fetchFeedXml } from "@/lib/ingest/rss";
import { parseFeed } from "@/lib/ingest/rss-parse";
import { createAdminClient } from "@/lib/supabase/admin";
import { itunesLookupDepsFromEnv, lookupPodcastArtwork } from "@/lib/work-picker/itunes";
import { runCoverBackfill, type CoverBackfillResult, type PendingCover } from "./backfill";

interface PendingRow {
  id: string;
  title: string;
  itunes_id: number | null;
  feed_url: string | null;
}

async function listPendingPodcastCovers(limit: number, retryBefore: string): Promise<PendingCover[]> {
  const { data, error } = await createAdminClient()
    .from("works")
    .select("id, title, itunes_id, feed_url")
    .eq("kind", "podcast_episode")
    .is("poster_url", null)
    .or(`cover_checked_at.is.null,cover_checked_at.lt.${retryBefore}`)
    .order("cover_checked_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`讀取待補封面作品失敗：${error.message}`);
  return ((data ?? []) as PendingRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    itunesId: row.itunes_id,
    feedUrl: row.feed_url,
  }));
}

/** 只補空的：使用者或其他來源先寫的封面不覆蓋 */
export async function fillEmptyPoster(workId: string, url: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("works")
    .update({ poster_url: url })
    .eq("id", workId)
    .is("poster_url", null)
    .select("id");
  if (error) throw new Error(`寫入封面失敗：${error.message}`);
  return (data ?? []).length > 0;
}

async function markCoverChecked(workId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("works")
    .update({ cover_checked_at: new Date().toISOString() })
    .eq("id", workId);
  if (error) throw new Error(`記錄封面查過時間失敗：${error.message}`);
}

async function feedImage(feedUrl: string): Promise<string | null> {
  return parseFeed(await fetchFeedXml(feedUrl)).imageUrl;
}

export async function refreshMissingCovers(now = new Date()): Promise<CoverBackfillResult> {
  const lookupDeps = itunesLookupDepsFromEnv();
  return runCoverBackfill(
    {
      listPending: listPendingPodcastCovers,
      lookupArtwork: (itunesId) => lookupPodcastArtwork(itunesId, lookupDeps),
      feedImage,
      save: async (workId, url) => {
        await fillEmptyPoster(workId, url);
      },
      markChecked: markCoverChecked,
      notify: getServerNotify(),
    },
    now,
  );
}
