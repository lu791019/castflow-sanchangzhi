/** 資訊欄（作品特輯、分享頁）用：在哪看改吃合併連結，另附買票／官網區（server only） */

import { NO_WATCH_INFO, type WatchInfo } from "@/lib/watch/service";
import type { WorkKind } from "@/lib/works/format";
import { loadWorkLinks } from "./repository";
import type { SpotifyRef } from "./spotify";
import type { WorkLinksView } from "./types";
import { boxWatchInfo } from "./view";

export interface InfoBoxLinks {
  workId: string;
  workKind: WorkKind;
  view: WorkLinksView;
  /** 音樂、Podcast 的 Spotify 直連（播放器用）；沒有 null */
  spotify: SpotifyRef | null;
}

export interface InfoBoxLinksData {
  /** InfoBox 的 watch：null = 不顯示在哪看（演出／展覽） */
  watch: WatchInfo | null;
  links: InfoBoxLinks | null;
}

export async function loadInfoBoxLinks(work: { id: string; kind: WorkKind }): Promise<InfoBoxLinksData> {
  const loaded = await loadWorkLinks(work.id);
  const onSite = work.kind === "live" || work.kind === "exhibition";
  if (!loaded) return { watch: onSite ? null : NO_WATCH_INFO, links: null };
  const { watchInfo, spotify, ...view } = loaded;
  return {
    watch: boxWatchInfo(view, watchInfo),
    links: { workId: work.id, workKind: work.kind, view, spotify },
  };
}
