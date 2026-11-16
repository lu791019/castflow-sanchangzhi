/**
 * 音樂、Podcast「在哪聽」疊上 Spotify 直連（Q-64 A①，純函式，server／client 皆可用）：
 * 音樂把原本的 Spotify 搜尋列換成直連；Podcast 插在 Apple Podcasts 後面（沒有就放第一列）。其他平台列不動。
 */

import type { PlatformRow, WatchInfo } from "@/lib/watch/service";
import type { WorkKind } from "@/lib/works/format";
import { SPOTIFY_LABEL, SPOTIFY_SOURCE, spotifyRefFor, spotifyUrl, type SpotifyRef } from "./spotify";
import type { WorkLink } from "./types";

const DIRECT_NOTE = "直連";

export function isListenWorkKind(kind: WorkKind): boolean {
  return kind === "music" || kind === "podcast_episode";
}

/** 存的連結裡找 Spotify 直連（類型要對得上作品類別，否則當沒有） */
export function spotifyRefOf(kind: WorkKind, links: readonly WorkLink[]): SpotifyRef | null {
  const link = links.find((item) => item.kind === "watch" && item.source === SPOTIFY_SOURCE);
  return link ? spotifyRefFor(kind, link.url) : null;
}

export function withSpotifyListen(info: WatchInfo | null, ref: SpotifyRef): WatchInfo {
  const row: PlatformRow = { name: SPOTIFY_LABEL, note: DIRECT_NOTE, url: spotifyUrl(ref) };
  const platforms = info?.status === "available" ? info.platforms : [];
  const existing = platforms.findIndex((platform) => platform.name === SPOTIFY_LABEL);
  const at = existing >= 0 ? existing : platforms[0]?.name.startsWith("Apple") ? 1 : 0;
  return {
    status: "available",
    platforms: [...platforms.slice(0, at), row, ...platforms.slice(existing >= 0 ? at + 1 : at)],
    attribution: info?.status === "available" ? info.attribution : null,
  };
}

/** 「告訴我們在哪聽」的字（TellUs copy）：只收 Spotify，說清楚收哪幾種 */
export function listenTellUsCopy(kind: WorkKind): { button: string; placeholder: string; footnote: string } {
  const podcast = kind === "podcast_episode";
  return {
    button: "有 Spotify 連結？告訴我們",
    placeholder: `貼上 Spotify 網址，例：https://open.spotify.com/${podcast ? "show" : "album"}/…`,
    footnote: `目前只收 Spotify 的${podcast ? "節目、單集" : "專輯、歌曲"}連結，貼上就會出現。`,
  };
}
