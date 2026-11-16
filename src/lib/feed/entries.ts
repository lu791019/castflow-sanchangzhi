/** 今晚的目錄 feed：把「有 blog 文案的 episodes」整理成雜誌目錄條目 */

import { displayAuthor, parseByline } from "@/lib/proof/publish";
import {
  extractPullQuote,
  extractWorkTitle,
  parseArticle,
} from "@/lib/share/article";

import { leadExcerpt } from "@/lib/wide/excerpt";

import { fallbackWorkKind, feedCategory, type FeedCategory, type FeedTab } from "./categories";

export {
  CATEGORY_LABELS,
  CATEGORY_TAB_LABELS,
  FEED_CATEGORIES,
  FEED_TABS,
  feedCategory,
  feedTabHref,
  parseFeedTab,
  type FeedCategory,
  type FeedTab,
} from "./categories";

export interface FeedSourceRow {
  id: string;
  title: string;
  source: string;
  created_at: string;
  share_slug: string | null;
  blogBody: string;
  /** 作者在校樣選定的引言（沒選時自動抽句） */
  pull_quote?: string | null;
  /** 綁定作品的海報（TMDB）與片名；沒綁作品為空 */
  poster_url?: string | null;
  work_title?: string | null;
  work_kind?: string | null;
  /** 署名（feedAuthor 算好）：筆名、「匿名」；RSS 節目素材為 null */
  author?: string | null;
}

export interface FeedVisibilityRow {
  source: string;
  visibility?: string | null;
  published_at?: string | null;
}

/**
 * 今晚的目錄只列「公開」：作者的文章要已發佈且公開範圍為公開；
 * RSS 節目（作品素材）沒有發佈流程，維持原本照列。
 */
export function isListedInFeed(row: FeedVisibilityRow): boolean {
  if ((row.visibility ?? "public") !== "public") return false;
  return row.source === "rss" || Boolean(row.published_at);
}

export interface FeedEntry {
  id: string;
  title: string;
  quote: string | null;
  workTitle: string | null;
  /** 綁定作品的海報；沒有才用字卡／占位 */
  posterUrl: string | null;
  /** 綁定作品的類型（決定字卡樣式）；沒綁作品：RSS 素材用 Podcast 字卡、其餘是隨筆（essay） */
  workKind: string;
  category: FeedCategory;
  href: string;
  createdAt: string;
  /** 目錄卡署名；null＝不署名（RSS 節目素材） */
  author: string | null;
  /** 內文開頭（跳過導言，最多兩段）：寬版目錄封面故事用 */
  excerpt?: string[];
}

/** 舊規則（只看 source）：只剩「我的」作者統計在用；目錄分類改用 feedCategory（看作品類別） */
export function categoryFromSource(source: string): "screen" | "podcast" {
  return source === "text" ? "screen" : "podcast";
}

/**
 * 條目連結：RSS podcast 單集進單集閱讀頁；
 * 其餘有 share_slug 走公開分享頁，沒有導去校樣（社交介面不連舊的內容編輯器）
 */
export function feedEntryHref(row: {
  id: string;
  share_slug: string | null;
  source?: string;
}): string {
  if (row.source === "rss") return `/episodes/${row.id}/read`;
  return row.share_slug ? `/s/${row.share_slug}` : `/proof/${row.id}`;
}

/**
 * 目錄卡署名（UX-23）：跟分享頁、作品特輯同一套（displayAuthor）——筆名署名寫作者筆名、匿名寫「匿名」；
 * RSS 節目素材不是讀者寫的，不署名。
 */
export function feedAuthor(row: { source: string; byline: unknown; penName: string }): string | null {
  if (row.source === "rss") return null;
  return displayAuthor(parseByline(row.byline) ?? "pen_name", row.penName);
}

/** 「《海街日記》 — 林小晴」；缺哪個就省哪個 */
export function feedBylineText(workTitle: string | null, author: string | null): string {
  const work = workTitle ? `《${workTitle}》` : "";
  if (!author) return work;
  return work ? `${work} — ${author}` : author;
}

export function buildFeedEntries(rows: FeedSourceRow[]): FeedEntry[] {
  return rows.map((row) => {
    const parsed = parseArticle(row.blogBody);
    const title = parsed.title ?? row.title;
    const category = feedCategory(row);
    return {
      id: row.id,
      title,
      quote: row.pull_quote ?? extractPullQuote(parsed.blocks),
      workTitle: extractWorkTitle(title, row.title, row.blogBody) ?? row.work_title ?? null,
      posterUrl: row.poster_url ?? null,
      workKind: row.work_kind ?? fallbackWorkKind(category),
      category,
      href: feedEntryHref(row),
      createdAt: row.created_at,
      author: row.author ?? null,
      excerpt: leadExcerpt(row.blogBody),
    };
  });
}

export function filterFeedEntries(
  entries: FeedEntry[],
  tab: FeedTab,
): FeedEntry[] {
  if (tab === "all") return entries;
  return entries.filter((entry) => entry.category === tab);
}

/** 今晚的一句：取第一個抽得到引句的條目 */
export function pickTonightQuote(
  entries: FeedEntry[],
): { quote: string; fromTitle: string } | null {
  for (const entry of entries) {
    if (entry.quote) return { quote: entry.quote, fromTitle: entry.title };
  }
  return null;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/** 刊頭日期：10.08 週四 */
export function formatMastheadDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day} 週${WEEKDAY_LABELS[date.getDay()]}`;
}

/** 版別跟著時段走：晨間 / 午間 / 晚間 */
export function editionLabel(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return "晨間版";
  if (hour < 17) return "午間版";
  return "晚間版";
}

/** 期數：當年第幾天，補零成 4 位（同一天固定） */
export function feedIssueNo(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
  return String(dayOfYear).padStart(4, "0");
}
