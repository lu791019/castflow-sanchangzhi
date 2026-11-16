"use client";

/**
 * 音樂、Podcast 的「在哪聽」（資訊欄，Q-64）：平台列＋有 Spotify 直連時的官方播放器；沒有直連時「告訴我們」收 Spotify 連結。
 * 讀者送出、已生效的連結直接換畫面（直連列＋播放器），router.refresh() 只在背景同步（同 LiveWorkLinks）。
 */

import { useRouter } from "next/navigation";
import { startTransition, useSyncExternalStore } from "react";
import { WatchSection } from "@/components/share/watch-section";
import { listenTellUsCopy, withSpotifyListen } from "@/lib/links/listen";
import { spotifyRefFor, type SpotifyRef } from "@/lib/links/spotify";
import type { WorkLink } from "@/lib/links/types";
import { createKeyedStore } from "@/lib/ui/keyed-store";
import type { WatchInfo } from "@/lib/watch/service";
import type { WorkKind } from "@/lib/works/format";
import { SpotifyEmbed } from "./spotify-embed";
import { TellUs } from "./tell-us";

/** 依作品記讀者這次補的 Spotify 直連（不放元件 state：背景 refresh 重掛元件時不會掉） */
const addedSpotify = createKeyedStore<SpotifyRef | null>(null);

interface ListenWorkLinksProps {
  workId: string;
  workKind: WorkKind;
  watch: WatchInfo;
  spotify: SpotifyRef | null;
  readHref?: string | null;
}

export function ListenWorkLinks({ workId, workKind, watch, spotify, readHref = null }: ListenWorkLinksProps) {
  const router = useRouter();
  const added = useSyncExternalStore(addedSpotify.subscribe, () => addedSpotify.get(workId), () => null);
  const current = added ?? spotify;
  const shownWatch = added ? withSpotifyListen(watch, added) : watch;

  const onAdded = (link: WorkLink) => {
    const ref = spotifyRefFor(workKind, link.url);
    if (ref) addedSpotify.set(workId, ref);
    startTransition(() => router.refresh());
  };

  return (
    <>
      <WatchSection watch={shownWatch} podcast readHref={readHref} />
      {current ? (
        <SpotifyEmbed spotify={current} />
      ) : (
        <TellUs workId={workId} kinds={["watch"]} copy={listenTellUsCopy(workKind)} onAdded={onAdded} />
      )}
    </>
  );
}
