/**
 * 索引 › 作品：依類型分段的橫向書架（Token「index.shelf」）。
 * 只收至少有一段公開感受的作品；段內依最近一段由新到舊（order.noRank），段首計數用阿拉伯數字。
 * Podcast 以節目為單位（同節目各集合併段數），連到索引搜尋該節目。
 */

import { dateStamp } from "@/lib/journal/wording";
import { fromTaipei } from "@/lib/journal/time";

export type ShelfKind = "movie" | "series" | "podcast" | "music" | "performance" | "exhibition";

export interface CatalogWork {
  id: string;
  slug: string;
  kind: string;
  title: string;
  year: number | null;
  podcastShow: string | null;
  posterUrl: string | null;
  /** 演出／展覽日期 YYYY-MM-DD */
  eventDate: string | null;
  issueNo: number;
}

export interface ShelfItem {
  key: string;
  title: string;
  /** 字卡上的直排短名；影劇用作品名（見 coverTitle） */
  plate: string;
  /** 字卡旁的燒橙小字（演出日期） */
  mark: string;
  countLabel: string;
  href: string;
  /** 封面補齊：作品類型（決定字卡樣式）；有圖一律放圖，沒圖走字卡（WorkCover） */
  coverKind: string;
  posterUrl: string | null;
  latestAt: string;
}

export interface Shelf {
  kind: ShelfKind;
  label: string;
  countLabel: string;
  total: number;
  items: ShelfItem[];
}

const SHELF_ORDER: ReadonlyArray<{ kind: ShelfKind; label: string; unit: string }> = [
  { kind: "movie", label: "電影", unit: "部" },
  { kind: "series", label: "影集", unit: "部" },
  { kind: "podcast", label: "Podcast", unit: "個節目" },
  { kind: "music", label: "音樂", unit: "張" },
  { kind: "performance", label: "演出", unit: "場" },
  { kind: "exhibition", label: "展覽", unit: "檔" },
];

const KIND_TO_SHELF: Record<string, ShelfKind> = {
  movie: "movie",
  series: "series",
  podcast_episode: "podcast",
  music: "music",
  live: "performance",
  performance: "performance",
  exhibition: "exhibition",
};

const PLATE_MAX = 5;
const DEFAULT_PER_SHELF = 12;

export function shelfOfKind(kind: string): ShelfKind | null {
  return KIND_TO_SHELF[kind] ?? null;
}

/** 字卡短名：「島嶼夜歌・草地音樂會」→「島嶼夜歌」，最多五字 */
export function plateName(title: string): string {
  return Array.from(title.split(/[・·:：]/)[0].trim()).slice(0, PLATE_MAX).join("");
}

function eventMark(eventDate: string | null): string {
  const match = eventDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  // 中午取時刻，避開邏輯日（4 點換日）把日期往前推
  return dateStamp(fromTaipei(Number(match[1]), Number(match[2]), Number(match[3]), 12));
}

interface Tally {
  count: number;
  latestAt: string;
}

function tallyFeelings(feelings: ReadonlyArray<{ workId: string; publishedAt: string }>): Map<string, Tally> {
  const tally = new Map<string, Tally>();
  for (const { workId, publishedAt } of feelings) {
    const prev = tally.get(workId);
    tally.set(workId, {
      count: (prev?.count ?? 0) + 1,
      latestAt: prev && prev.latestAt > publishedAt ? prev.latestAt : publishedAt,
    });
  }
  return tally;
}

function workItem(work: CatalogWork, tally: Tally): ShelfItem {
  const onSite = shelfOfKind(work.kind) === "performance" || work.kind === "exhibition";
  return {
    key: work.id,
    title: work.title,
    plate: onSite ? plateName(work.title) : "",
    mark: shelfOfKind(work.kind) === "performance" ? eventMark(work.eventDate) : "",
    countLabel: `${tally.count} 段`,
    href: `/works/${work.slug}`,
    coverKind: work.kind,
    posterUrl: work.posterUrl,
    latestAt: tally.latestAt,
  };
}

/** 同節目的各集合併成一格；封面取任一集有的節目封面 */
function podcastItems(entries: ReadonlyArray<{ work: CatalogWork; tally: Tally }>): ShelfItem[] {
  const shows = new Map<string, Tally & { posterUrl: string | null }>();
  for (const { work, tally } of entries) {
    const show = (work.podcastShow ?? work.title).trim();
    const prev = shows.get(show);
    shows.set(show, {
      count: (prev?.count ?? 0) + tally.count,
      latestAt: prev && prev.latestAt > tally.latestAt ? prev.latestAt : tally.latestAt,
      posterUrl: prev?.posterUrl ?? work.posterUrl,
    });
  }
  return [...shows.entries()].map(([show, tally]) => ({
    key: `show:${show}`,
    title: show,
    plate: plateName(show),
    mark: "",
    countLabel: `${tally.count} 段`,
    href: `/catalog?q=${encodeURIComponent(show)}`,
    coverKind: "podcast",
    posterUrl: tally.posterUrl,
    latestAt: tally.latestAt,
  }));
}

export function buildShelves(
  works: ReadonlyArray<CatalogWork>,
  feelings: ReadonlyArray<{ workId: string; publishedAt: string }>,
  { perShelf = DEFAULT_PER_SHELF }: { perShelf?: number } = {},
): Shelf[] {
  const tally = tallyFeelings(feelings);
  return SHELF_ORDER.flatMap(({ kind, label, unit }) => {
    const entries = works.flatMap((work) => {
      const workTally = tally.get(work.id);
      return shelfOfKind(work.kind) === kind && workTally ? [{ work, tally: workTally }] : [];
    });
    const items = (kind === "podcast" ? podcastItems(entries) : entries.map(({ work, tally: t }) => workItem(work, t)))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    if (items.length === 0) return [];
    return [{ kind, label, countLabel: `${items.length} ${unit}`, total: items.length, items: items.slice(0, perShelf) }];
  });
}
