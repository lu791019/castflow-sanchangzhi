/**
 * 在哪看：TMDB watch providers 快照（works.watch_providers）與 curated 映射 → 按鈕。
 * TMDB 不給各平台深連結，快照每顆都連到 TMDB 觀看頁（資料由 JustWatch 提供，保留來源標註）；
 * curated 有平台直連頁時優先（合併在 service.ts；curated／本週熱門用的在 quick-links.ts，client 可用）。
 */

import { deriveWatchStatus, PROVIDER_KIND_LABELS, type WatchSnapshot } from "@/lib/watch/providers";
import type { WatchInfo } from "@/lib/watch/service";
import type { WorkLink } from "./types";

/** TMDB 平台名 → 與 sources.ts 白名單一致的來源鍵（同一平台 user／curated 與 tmdb 才能去重） */
const PROVIDER_SOURCES: Record<string, string> = {
  netflix: "netflix",
  "disney plus": "disneyplus",
  "amazon prime video": "primevideo",
  max: "max",
  "hbo max": "max",
  "apple tv plus": "appletv",
  "apple tv+": "appletv",
  catchplay: "catchplay",
  myvideo: "myvideo",
  "friday video": "friday",
  kktv: "kktv",
  "line tv": "linetv",
  "hami video": "hamivideo",
  iqiyi: "iqiyi",
  youtube: "youtube",
  gagaoolala: "gagaoolala",
  mubi: "mubi",
};

export function providerSource(name: string): string {
  const key = name.trim().toLowerCase();
  return PROVIDER_SOURCES[key] ?? `tmdb:${key.replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function snapshotWatchLinks(snapshot: WatchSnapshot | null, now: Date): WorkLink[] {
  if (!snapshot || deriveWatchStatus(snapshot, now) !== "available") return [];
  return snapshot.providers.map((provider) => ({
    kind: "watch",
    source: providerSource(provider.name),
    label: provider.name,
    url: provider.link,
    origin: "tmdb",
    note: PROVIDER_KIND_LABELS[provider.kind],
  }));
}

/** 作品頁：沿用 lib/watch 的快取（記憶體＋DB 24h，過期重抓）解析出的平台列 */
export function watchInfoLinks(info: WatchInfo | null): WorkLink[] {
  if (!info || info.status !== "available") return [];
  return info.platforms.flatMap((platform) =>
    platform.url
      ? [{ kind: "watch" as const, source: providerSource(platform.name), label: platform.name, url: platform.url, origin: "tmdb" as const, note: platform.note || null }]
      : [],
  );
}
