/**
 * 目錄分類（Q-61，10/15）：依「作品類別」分，不再看錄音或打字。
 * 影劇＝電影＋影集；演出含音樂祭、演唱會（works.kind=live）；沒綁作品的歸「隨筆」；
 * RSS 匯入的節目素材沒有綁作品，維持在 Podcast。
 */

export const FEED_CATEGORIES = ["screen", "podcast", "music", "live", "exhibition", "essay"] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];
export type FeedTab = "all" | FeedCategory;

/** 目錄卡上的燒橙小標 */
export const CATEGORY_LABELS: Record<FeedCategory, string> = {
  screen: "影劇",
  podcast: "PODCAST",
  music: "音樂",
  live: "演出",
  exhibition: "展覽",
  essay: "隨筆",
};

/** 分頁與桌機索引欄目的字 */
export const CATEGORY_TAB_LABELS: Record<FeedCategory, string> = {
  ...CATEGORY_LABELS,
  podcast: "Podcast",
};

export function feedTabHref(tab: FeedTab): string {
  return `/?tab=${tab}`;
}

export const FEED_TABS: ReadonlyArray<{ tab: FeedTab; label: string; href: string }> = [
  { tab: "all", label: "全部", href: feedTabHref("all") },
  ...FEED_CATEGORIES.map((category) => ({ tab: category, label: CATEGORY_TAB_LABELS[category], href: feedTabHref(category) })),
];

const CATEGORY_OF_KIND: Record<string, FeedCategory> = {
  movie: "screen",
  series: "screen",
  podcast_episode: "podcast",
  music: "music",
  live: "live",
  exhibition: "exhibition",
};

export function feedCategory(row: { source: string; work_kind?: string | null }): FeedCategory {
  const byKind = row.work_kind ? CATEGORY_OF_KIND[row.work_kind] : undefined;
  if (byKind) return byKind;
  return row.source === "rss" ? "podcast" : "essay";
}

/** 舊網址與常見別名：tab=screen／podcast 照舊；作品類別名稱也對得到 */
const TAB_ALIASES: Record<string, FeedTab> = {
  movie: "screen",
  series: "screen",
  podcast_episode: "podcast",
  performance: "live",
  festival: "live",
  concert: "live",
};

export function parseFeedTab(value: string | undefined): FeedTab {
  const key = value?.trim().toLowerCase() ?? "";
  if (key === "all" || (FEED_CATEGORIES as readonly string[]).includes(key)) return key as FeedTab;
  return TAB_ALIASES[key] ?? "all";
}

/** 沒綁作品時的字卡類型：RSS 素材用 Podcast 字卡，其餘是隨筆 */
export function fallbackWorkKind(category: FeedCategory): string {
  return category === "podcast" ? "podcast_episode" : "essay";
}
