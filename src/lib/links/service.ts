/**
 * 作品連結組裝：存的連結（user／manual）＋ curated 映射 ＋ TMDB 在哪看 ＋ 搜尋連結 → 合併（merge.ts）。
 * 依賴注入，純邏輯可測；實際接線在 repository.ts。讀取失敗推警報（不靜默），退回只有搜尋連結。
 */

import type { WatchSnapshot } from "@/lib/watch/providers";
import type { WatchInfo } from "@/lib/watch/service";
import type { VenueType } from "@/lib/venue/venue-type";
import type { WorkKind } from "@/lib/works/format";
import { isListenWorkKind, spotifyRefOf, withSpotifyListen } from "./listen";
import { mergeWorkLinks, primaryLink } from "./merge";
import { buildSearchLinks } from "./search-links";
import type { SpotifyRef } from "./spotify";
import type { WorkLink, WorkLinksView } from "./types";
import { curatedWatchLinks } from "./quick-links";
import { snapshotWatchLinks, watchInfoLinks } from "./watch-links";

export interface LinkWork {
  id: string;
  kind: WorkKind;
  title: string;
  tmdb_id: number | null;
  venue_type: VenueType | null;
}

export interface WorkLinksDeps {
  listStored: (workId: string) => Promise<WorkLink[]>;
  /** lib/watch 的在哪看（含快取與重抓）；演出／展覽回 null */
  loadWatchInfo: (workId: string) => Promise<WatchInfo | null>;
  warn: (title: string, detail: string) => void;
}

export interface LoadedWorkLinks extends WorkLinksView {
  /** 給資訊框的「在哪看／在哪聽」狀態（院線、Podcast、來源標註）；演出／展覽為 null */
  watchInfo: WatchInfo | null;
  /** 音樂、Podcast 有讀者補的 Spotify 直連時給播放器用；其他 null */
  spotify: SpotifyRef | null;
}

function isScreenKind(kind: WorkKind): kind is "movie" | "series" {
  return kind === "movie" || kind === "series";
}

function curatedOf(work: LinkWork): WorkLink[] {
  return isScreenKind(work.kind) && work.tmdb_id !== null ? curatedWatchLinks(work.kind, work.tmdb_id) : [];
}

async function storedOrEmpty(work: LinkWork, deps: WorkLinksDeps): Promise<WorkLink[]> {
  try {
    return await deps.listStored(work.id);
  } catch (error) {
    deps.warn(
      "在哪看／買票連結讀取失敗，先只給搜尋連結",
      `work=${work.id} ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export async function resolveWorkLinks(work: LinkWork, deps: WorkLinksDeps): Promise<LoadedWorkLinks> {
  const watchInfoPromise = work.kind === "live" || work.kind === "exhibition" ? Promise.resolve(null) : deps.loadWatchInfo(work.id);
  const [stored, watchInfo] = await Promise.all([storedOrEmpty(work, deps), watchInfoPromise]);
  // Podcast、音樂的「在哪聽」由 watchInfo 給（音樂是搜尋連結法，見 music-links.ts）；有 Spotify 直連就疊上去（listen.ts）
  if (isListenWorkKind(work.kind)) {
    const spotify = spotifyRefOf(work.kind, stored);
    return { ...mergeWorkLinks(work.kind, []), watchInfo: spotify ? withSpotifyListen(watchInfo, spotify) : watchInfo, spotify };
  }
  const search = buildSearchLinks({
    kind: work.kind,
    venueType: work.venue_type,
    title: work.title,
    inTheaters: watchInfo?.status === "in_theaters",
  });
  const merged = mergeWorkLinks(work.kind, [...stored, ...curatedOf(work), ...watchInfoLinks(watchInfo), ...search]);
  return { ...merged, watchInfo, spotify: null };
}

export interface ListLinkWork extends LinkWork {
  watch_providers: WatchSnapshot | null;
}

/** 列表（接下來）每列一顆次鈕：只用 DB 現有的快照，不為列表打 TMDB */
export function resolvePrimaryLinks(
  works: readonly ListLinkWork[],
  storedByWork: ReadonlyMap<string, WorkLink[]>,
  now: Date,
): Map<string, WorkLink | null> {
  return new Map(
    works.map((work) => {
      const links = [
        ...(storedByWork.get(work.id) ?? []),
        ...curatedOf(work),
        ...snapshotWatchLinks(work.watch_providers, now),
        ...buildSearchLinks({ kind: work.kind, venueType: work.venue_type, title: work.title }),
      ];
      return [work.id, primaryLink(work.kind, links)];
    }),
  );
}
