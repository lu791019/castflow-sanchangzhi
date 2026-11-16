/**
 * Spotify 直連（Q-64 A①、B）：讀者在「告訴我們在哪聽」貼的 open.spotify.com 連結 → 驗證、正規化、組官方播放器網址。
 * 純函式，server／client 皆可用；不打 Spotify 任何 API。短網址（spotify.link）要打外部服務才展開，不支援、請讀者貼完整網址。
 */

import type { WorkKind } from "@/lib/works/format";
import { parseHttpUrl } from "./sources.ts";

export const SPOTIFY_SOURCE = "spotify";
export const SPOTIFY_LABEL = "Spotify";
/** work_links.added_by：系統搜尋自動配對的直連（Q-64 A②）；讀者貼的是使用者 id */
export const SPOTIFY_AUTO_ADDED_BY = "system:spotify-search";

export const SPOTIFY_TYPES = ["album", "track", "show", "episode"] as const;
export type SpotifyType = (typeof SPOTIFY_TYPES)[number];

export interface SpotifyRef {
  type: SpotifyType;
  id: string;
}

export type SpotifyParseFailure = "not_spotify" | "short_link" | "unsupported_type" | "malformed";
export type SpotifyParse = { ok: true; ref: SpotifyRef } | { ok: false; reason: SpotifyParseFailure };

const OPEN_HOST = "open.spotify.com";
const SHORT_HOSTS = ["spotify.link", "spotify.app.link"];
/** Spotify ID：22 碼 base62 */
const ID_PATTERN = /^[A-Za-z0-9]{22}$/;
/** 語系前綴：/intl-ja/、/intl-zh-tw/… */
const LOCALE_SEGMENT = /^intl-[a-z]{2}(?:-[a-z]{2,4})?$/i;

/** 官方播放器高度（Spotify 產生器的預設值）：專輯、節目有曲目／單集列表 */
export const SPOTIFY_EMBED_HEIGHT: Record<SpotifyType, number> = { album: 352, show: 352, episode: 232, track: 152 };

/** 各作品類別收哪些類型：音樂收專輯、歌曲；Podcast 收節目、單集 */
const TYPES_FOR: Partial<Record<WorkKind, readonly SpotifyType[]>> = {
  music: ["album", "track"],
  podcast_episode: ["show", "episode"],
};

function matchesHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function isSpotifyType(value: string | undefined): value is SpotifyType {
  return SPOTIFY_TYPES.some((type) => type === value);
}

/** 主機名是不是 Spotify 的（含短網址），給非音樂作品擋 Spotify 連結用 */
export function isSpotifyHost(value: string): boolean {
  const url = parseHttpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return matchesHost(host, "spotify.com") || SHORT_HOSTS.some((domain) => matchesHost(host, domain));
}

export function parseSpotifyUrl(value: string): SpotifyParse {
  const url = parseHttpUrl(value.trim());
  if (!url) return { ok: false, reason: "not_spotify" };
  const host = url.hostname.toLowerCase();
  if (SHORT_HOSTS.some((domain) => matchesHost(host, domain))) return { ok: false, reason: "short_link" };
  if (host !== OPEN_HOST) return { ok: false, reason: matchesHost(host, "spotify.com") ? "malformed" : "not_spotify" };

  const all = url.pathname.split("/").filter(Boolean);
  const unlocalized = LOCALE_SEGMENT.test(all[0] ?? "") ? all.slice(1) : all;
  const segments = unlocalized[0] === "embed" ? unlocalized.slice(1) : unlocalized;
  const [type, id, ...rest] = segments;
  if (!type) return { ok: false, reason: "malformed" };
  if (!isSpotifyType(type)) return { ok: false, reason: "unsupported_type" };
  if (!id || !ID_PATTERN.test(id) || rest.length > 0) return { ok: false, reason: "malformed" };
  return { ok: true, ref: { type, id } };
}

/** 正規化：去語系前綴、追蹤參數（?si= 等），統一成 https://open.spotify.com/<type>/<id> */
export function spotifyUrl(ref: SpotifyRef): string {
  return `https://${OPEN_HOST}/${ref.type}/${ref.id}`;
}

/** 官方 embed iframe 網址；深色主題用 theme=0（黑底），明亮沿用 Spotify 依封面取色 */
export function spotifyEmbedUrl(ref: SpotifyRef, dark: boolean): string {
  return `https://${OPEN_HOST}/embed/${ref.type}/${ref.id}?utm_source=generator${dark ? "&theme=0" : ""}`;
}

export function spotifyTypesFor(kind: WorkKind): readonly SpotifyType[] {
  return TYPES_FOR[kind] ?? [];
}

/** 已存的連結（server 讀出或讀者剛補的）→ 播放器用的 ref；類型對不上作品類別就不算 */
export function spotifyRefFor(kind: WorkKind, url: string): SpotifyRef | null {
  const parsed = parseSpotifyUrl(url);
  return parsed.ok && spotifyTypesFor(kind).includes(parsed.ref.type) ? parsed.ref : null;
}

export type ListenLinkCheck = { ok: true; ref: SpotifyRef; url: string } | { ok: false; error: string };

const WANTED: Partial<Record<WorkKind, { label: string; wrongKind: string }>> = {
  music: { label: "專輯或歌曲", wrongKind: "這是 Podcast 的連結，這裡要貼專輯或歌曲。" },
  podcast_episode: { label: "節目或單集", wrongKind: "這是音樂的連結，這裡要貼節目或單集。" },
};

/** 「告訴我們在哪聽」：只收 Spotify，且類型要對得上作品類別；回正規化後的網址 */
export function checkListenLink(kind: WorkKind, value: string): ListenLinkCheck {
  const wanted = WANTED[kind];
  if (!wanted) return { ok: false, error: "Spotify 連結只能補在音樂或 Podcast。" };
  const parsed = parseSpotifyUrl(value);
  if (!parsed.ok) {
    switch (parsed.reason) {
      case "short_link":
        return { ok: false, error: "短網址看不出是哪一張，請貼 open.spotify.com 開頭的完整網址。" };
      case "unsupported_type":
        return { ok: false, error: `播放清單、歌手頁不收，請貼${wanted.label}的連結。` };
      case "malformed":
        return { ok: false, error: "這個 Spotify 網址不完整，再複製一次。" };
      default:
        return { ok: false, error: "在哪聽目前只收 Spotify 連結（open.spotify.com）。" };
    }
  }
  if (!spotifyTypesFor(kind).includes(parsed.ref.type)) return { ok: false, error: wanted.wrongKind };
  return { ok: true, ref: parsed.ref, url: spotifyUrl(parsed.ref) };
}
