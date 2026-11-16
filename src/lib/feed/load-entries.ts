/** 目錄條目讀取（server only）：首頁目錄與散場之前「有人說了」共用 */

import { loadPenNames } from "@/lib/me/pen-name";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFeedEntries, feedAuthor, filterFeedEntries, isListedInFeed, type FeedEntry, type FeedTab } from "./entries";

const FEED_SCAN_LIMIT = 30;
/** 分類分頁：分類看作品類別（要 join 才知道），往回多掃一些再過濾，冷門類別才不會因為不在最新 30 篇裡而整頁空白 */
const CATEGORY_SCAN_LIMIT = 200;

interface JoinedWork {
  poster_url: string | null;
  kind: string;
  title: string;
}

/** episodes → works 是多對一，PostgREST 回物件；未產生型別時 client 推成陣列，兩種都收 */
function joinedWork(value: JoinedWork | JoinedWork[] | null | undefined): JoinedWork | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadFeedEntries({ tab = "all" }: { tab?: FeedTab } = {}): Promise<FeedEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select(
      "id, title, source, created_at, share_slug, visibility, published_at, pull_quote, user_id, byline, contents!inner(body, platform), works(poster_url, kind, title)",
    )
    .eq("contents.platform", "blog")
    .eq("visibility", "public")
    .or("published_at.not.is.null,source.eq.rss")
    .order("created_at", { ascending: false })
    .limit(tab === "all" ? FEED_SCAN_LIMIT : CATEGORY_SCAN_LIMIT);

  if (error || !data) return [];

  // 署名各自作者的筆名（UX-23）；RSS 節目素材不署名，不必查
  const penNames = await loadPenNames(data.flatMap((row) => (row.source !== "rss" && row.user_id ? [row.user_id as string] : [])));

  const entries = buildFeedEntries(
    data.flatMap((row) => {
      const blogBody = row.contents?.[0]?.body;
      if (!blogBody || !isListedInFeed(row)) return [];
      const work = joinedWork(row.works);
      return [
        {
          id: row.id,
          title: row.title,
          source: row.source,
          created_at: row.created_at,
          share_slug: row.share_slug,
          blogBody,
          pull_quote: row.pull_quote,
          poster_url: work?.poster_url ?? null,
          work_title: work?.title ?? null,
          work_kind: work?.kind ?? null,
          author: feedAuthor({ source: row.source, byline: row.byline, penName: penNames.get(row.user_id as string) ?? "" }),
        },
      ];
    }),
  );
  return filterFeedEntries(entries, tab).slice(0, FEED_SCAN_LIMIT);
}
