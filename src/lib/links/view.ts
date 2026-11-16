/** 連結的畫面用整理（純函式，server）：資訊框「在哪看」 */

import { WATCH_ATTRIBUTION } from "@/lib/watch/providers";
import type { WatchInfo } from "@/lib/watch/service";
import { isRealLink } from "./merge";
import type { LinkOrigin, WorkLinksView } from "./types";

const ORIGIN_NOTES: Partial<Record<LinkOrigin, string>> = {
  curated: "直連",
  user: "讀者補充",
  manual: "讀者補充",
};

/**
 * 資訊框沿用 InfoBox 的「在哪看」四種狀態：有真連結 → 列表（user／curated 直連在前、TMDB 在後）；
 * 沒有 → 原本 lib/watch 的狀態（院線、無資料、Podcast 在哪聽）照舊。含 TMDB 來源才標 JustWatch。
 */
export function boxWatchInfo(links: WorkLinksView, watchInfo: WatchInfo | null): WatchInfo | null {
  const real = links.watch.filter(isRealLink);
  if (real.length === 0) return watchInfo;
  return {
    status: "available",
    platforms: real.map((link) => ({ name: link.label, note: link.note ?? ORIGIN_NOTES[link.origin] ?? "", url: link.url })),
    attribution: real.some((link) => link.origin === "tmdb") ? WATCH_ATTRIBUTION : null,
  };
}
