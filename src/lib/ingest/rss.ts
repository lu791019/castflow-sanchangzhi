import { createAdminClient } from "@/lib/supabase/admin";
import { RssIngestError } from "./rss-errors";
import { parseFeed, selectNewItems, type FeedItem, type ParsedFeed } from "./rss-parse";

export const FEED_FETCH_TIMEOUT_MS = 10_000;

/** 部分 feed 伺服器擋空 UA，用正常瀏覽器字串 */
const FEED_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PG_UNIQUE_VIOLATION = "23505";

export interface SubscribedFeed {
  id: string;
  url: string;
  title: string | null;
}

/** poll 用：帶擁有者，新集數沿用 feed 的 user_id */
interface OwnedFeed extends SubscribedFeed {
  user_id: string;
}

export interface SubscribeRssResult {
  feed: SubscribedFeed;
  episode: { id: string; title: string; audioUrl: string };
}

export interface PollFeedResult {
  feedId: string;
  url: string;
  title: string | null;
  added: number;
  error?: string;
}

/** 純驗證：回傳錯誤訊息，通過則回傳 null */
export function validateFeedUrl(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return "請提供 feedUrl";
  }
  const { feedUrl } = input as Record<string, unknown>;
  if (typeof feedUrl !== "string" || !feedUrl.trim()) {
    return "feedUrl 不能為空";
  }
  try {
    const url = new URL(feedUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "feedUrl 必須是 http(s) URL";
    }
  } catch {
    return "feedUrl 不是合法的 URL";
  }
  return null;
}

/** 抓 feed 原文：timeout 10s + 瀏覽器 UA；失敗統一拋 fetch_failed */
export async function fetchFeedXml(feedUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(feedUrl, {
      headers: { "User-Agent": FEED_USER_AGENT, Accept: "*/*" },
      signal: AbortSignal.timeout(FEED_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "TimeoutError"
        ? `逾時（${FEED_FETCH_TIMEOUT_MS / 1000}s）`
        : error instanceof Error
          ? error.message
          : "未知錯誤";
    throw new RssIngestError("fetch_failed", `抓取 feed 失敗：${detail}`);
  }

  if (!response.ok) {
    throw new RssIngestError(
      "fetch_failed",
      `抓取 feed 失敗：HTTP ${response.status}`,
    );
  }
  return response.text();
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** 單集閱讀頁要的 RSS 欄位（migration 011）；缺值存 null，不做假 */
export function episodeMetaColumns(item: FeedItem): Record<string, unknown> {
  const aired = item.publishedAt ? new Date(item.publishedAt) : null;
  return {
    aired_at: aired && !Number.isNaN(aired.getTime()) ? aired.toISOString() : null,
    duration_seconds: item.durationSeconds,
    episode_number: item.episodeNumber,
    season_number: item.seasonNumber,
    author: item.author,
  };
}

/** 節目層級欄位：封面 + 作者（有值才覆寫，避免 feed 暫時缺欄位時洗掉舊值） */
function feedMetaColumns(parsed: ParsedFeed): Record<string, unknown> {
  return {
    ...(parsed.imageUrl ? { image_url: parsed.imageUrl } : {}),
    ...(parsed.author ? { author: parsed.author } : {}),
  };
}

/**
 * 補齊既有集數的 RSS 欄位（migration 011 之前入庫的集數沒有播出日期/長度/集數）。
 * 只動 aired_at 為 null 且仍在 feed 內的集數。
 */
async function backfillEpisodeMeta(
  supabase: AdminClient,
  feedId: string,
  items: FeedItem[],
): Promise<void> {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, guid")
    .eq("feed_id", feedId)
    .is("aired_at", null);
  if (error) {
    throw new Error(`查詢待補欄位集數失敗：${error.message}`);
  }
  const byGuid = new Map(items.map((item) => [item.guid, item]));
  for (const row of (data ?? []) as Array<{ id: string; guid: string | null }>) {
    const item = row.guid ? byGuid.get(row.guid) : undefined;
    if (!item) continue;
    const { error: updateError } = await supabase
      .from("episodes")
      .update(episodeMetaColumns(item))
      .eq("id", row.id);
    if (updateError) {
      throw new Error(`補齊集數欄位失敗：${updateError.message}`);
    }
  }
}

/** 同 feed 同 guid 不重複建集：已存在則跳過（unique index 23505 作為併發 backstop） */
async function insertEpisodeIfNew(
  supabase: AdminClient,
  feedId: string,
  item: FeedItem,
  userId: string,
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: queryError } = await supabase
    .from("episodes")
    .select("id")
    .eq("feed_id", feedId)
    .eq("guid", item.guid)
    .maybeSingle();

  if (queryError) {
    throw new Error(`查詢既有集數失敗：${queryError.message}`);
  }
  if (existing) {
    return { id: existing.id, created: false };
  }

  const { data: episode, error: insertError } = await supabase
    .from("episodes")
    .insert({
      user_id: userId,
      title: item.title,
      audio_url: item.audioUrl,
      source: "rss",
      status: "uploaded",
      feed_id: feedId,
      guid: item.guid,
      ...episodeMetaColumns(item),
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      return { id: "", created: false };
    }
    throw new Error(`建立 episode 失敗：${insertError.message}`);
  }
  return { id: episode.id, created: true };
}

/**
 * 訂閱 feed：抓取 → 解析 → 存 feeds → 取最新 1 集建 episode（source='rss'，
 * status 走既有待轉錄狀態 'uploaded'，等 worker 轉錄）。重複訂閱拋 already_subscribed。
 */
export async function subscribeRss(
  userId: string,
  feedUrl: string,
): Promise<SubscribeRssResult> {
  const url = feedUrl.trim();
  const xml = await fetchFeedXml(url);
  const parsed = parseFeed(xml);

  const supabase = createAdminClient();

  const { data: feed, error: feedError } = await supabase
    .from("feeds")
    .insert({
      user_id: userId,
      url,
      title: parsed.title,
      last_checked_at: new Date().toISOString(),
      ...feedMetaColumns(parsed),
    })
    .select("id, url, title")
    .single();

  if (feedError || !feed) {
    if (feedError?.code === PG_UNIQUE_VIOLATION) {
      throw new RssIngestError("already_subscribed", "已訂閱此 feed");
    }
    throw new Error(`建立 feed 失敗：${feedError?.message ?? "unknown"}`);
  }

  const latest = parsed.items[0];
  const { id: episodeId } = await insertEpisodeIfNew(supabase, feed.id, latest, userId);

  return {
    feed: { id: feed.id, url: feed.url, title: feed.title },
    episode: { id: episodeId, title: latest.title, audioUrl: latest.audioUrl },
  };
}

/** 檢查單一 feed 的新集數（舊→新入庫，保持建立順序） */
async function pollOneFeed(
  supabase: AdminClient,
  feed: OwnedFeed,
): Promise<number> {
  const xml = await fetchFeedXml(feed.url);
  const parsed = parseFeed(xml);

  const { data: rows, error: guidError } = await supabase
    .from("episodes")
    .select("guid")
    .eq("feed_id", feed.id)
    .not("guid", "is", null);

  if (guidError) {
    throw new Error(`查詢既有 guid 失敗：${guidError.message}`);
  }

  const knownGuids = new Set<string>(
    (rows ?? []).map((row: { guid: string }) => row.guid),
  );
  const newItems = selectNewItems(parsed.items, knownGuids);

  let added = 0;
  for (const item of [...newItems].reverse()) {
    const { created } = await insertEpisodeIfNew(supabase, feed.id, item, feed.user_id);
    if (created) added += 1;
  }
  await backfillEpisodeMeta(supabase, feed.id, parsed.items);

  const { error: updateError } = await supabase
    .from("feeds")
    .update({
      last_checked_at: new Date().toISOString(),
      title: parsed.title ?? feed.title,
      ...feedMetaColumns(parsed),
    })
    .eq("id", feed.id);

  if (updateError) {
    throw new Error(`更新 feed 檢查時間失敗：${updateError.message}`);
  }
  return added;
}

/** worker 用：遍歷所有使用者的 feeds 檢查新集（新集數歸 feed 擁有者）；單一 feed 失敗不中斷其他 feed，錯誤記在該筆結果 */
export async function pollAllFeeds(): Promise<PollFeedResult[]> {
  const supabase = createAdminClient();

  const { data: feeds, error } = await supabase
    .from("feeds")
    .select("id, url, title, user_id")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`讀取 feeds 失敗：${error.message}`);
  }

  const results: PollFeedResult[] = [];
  for (const feed of (feeds ?? []) as OwnedFeed[]) {
    const base = { feedId: feed.id, url: feed.url, title: feed.title };
    try {
      const added = await pollOneFeed(supabase, feed);
      results.push({ ...base, added });
    } catch (pollError) {
      const message =
        pollError instanceof Error ? pollError.message : "未知錯誤";
      results.push({ ...base, added: 0, error: message });
    }
  }
  return results;
}

/** 列出已訂閱 feeds（UI 顯示用） */
export async function listFeeds(userId: string): Promise<
  Array<SubscribedFeed & { created_at: string }>
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feeds")
    .select("id, url, title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`讀取 feeds 失敗：${error.message}`);
  }
  return data ?? [];
}
