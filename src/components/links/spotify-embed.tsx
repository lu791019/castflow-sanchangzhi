"use client";

/**
 * Spotify 官方播放器（Q-64 B）：直接組 embed iframe 網址，不打 oEmbed、不需金鑰。
 * 延遲載入（loading="lazy"，捲到附近才載）；主題跟著 <html data-theme>（放映廳用 theme=0 黑底）。
 * 伺服器與 hydrate 前先畫等高的空框（主題要到 client 才知道），版面不跳。寬螢幕最寬 max-w-3xl（同表單頁），不撐滿 1360。
 */

import { useSyncExternalStore } from "react";
import { SPOTIFY_EMBED_HEIGHT, spotifyEmbedUrl, type SpotifyRef, type SpotifyType } from "@/lib/links/spotify";

const TYPE_LABELS: Record<SpotifyType, string> = { album: "專輯", track: "歌曲", show: "節目", episode: "單集" };

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readTheme = () => document.documentElement.getAttribute("data-theme") ?? "light";

export function SpotifyEmbed({ spotify }: { spotify: SpotifyRef }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => null);
  const height = SPOTIFY_EMBED_HEIGHT[spotify.type];
  return (
    <div className="mt-4 overflow-hidden rounded-[12px] bg-ink-50 lg:max-w-3xl" style={{ height }}>
      {theme ? (
        <iframe
          src={spotifyEmbedUrl(spotify, theme === "screen")}
          title={`Spotify 播放器（${TYPE_LABELS[spotify.type]}）`}
          width="100%"
          height={height}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="block w-full border-0"
        />
      ) : null}
    </div>
  );
}
