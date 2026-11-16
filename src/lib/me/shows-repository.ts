/** 我的節目：讀自己的 RSS 訂閱（含最近一集）、取消訂閱。一律帶 user_id 過濾 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ShowLatestEpisode, ShowRowInput } from "./shows";

interface FeedRow {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  image_url: string | null;
}

interface EpisodeRow extends ShowLatestEpisode {
  feed_id: string;
}

/** 每個節目只取最近一集：先撈這些 feed 最近的集數（每 feed 上限內），再依 feed 取第一筆 */
const LATEST_SCAN_LIMIT = 200;

export async function listMyShows(userId: string): Promise<ShowRowInput[]> {
  const supabase = createAdminClient();
  const { data: feeds, error } = await supabase
    .from("feeds")
    .select("id, url, title, author, image_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`讀取訂閱失敗：${error.message}`);
  const feedRows = (feeds ?? []) as FeedRow[];
  if (feedRows.length === 0) return [];

  const { data: episodes, error: episodeError } = await supabase
    .from("episodes")
    .select("feed_id, aired_at, created_at, episode_number, season_number")
    .eq("user_id", userId)
    .in(
      "feed_id",
      feedRows.map((feed) => feed.id),
    )
    .order("aired_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(LATEST_SCAN_LIMIT);
  if (episodeError) throw new Error(`讀取節目集數失敗：${episodeError.message}`);

  const latestByFeed = new Map<string, ShowLatestEpisode>();
  for (const episode of (episodes ?? []) as EpisodeRow[]) {
    if (!latestByFeed.has(episode.feed_id)) latestByFeed.set(episode.feed_id, episode);
  }
  return feedRows.map((feed) => ({ ...feed, latest: latestByFeed.get(feed.id) ?? null }));
}

export async function countMyShows(userId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("feeds")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`讀取訂閱數失敗：${error.message}`);
  return count ?? 0;
}

/** 取消訂閱：只刪自己的 feed；已入庫的集數與說過的感受保留（episodes.feed_id on delete set null） */
export async function unsubscribeShow(userId: string, feedId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("feeds")
    .delete()
    .eq("id", feedId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(`取消訂閱失敗：${error.message}`);
  return (data ?? []).length > 0;
}
