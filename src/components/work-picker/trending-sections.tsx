"use client";

/** 面板空狀態的「本週熱門」：還沒打字就有東西可以點（Dex 10/13）。小標只寫「正在上映」「本週熱門」，不標來源 */

import { TrendingLink } from "@/components/links/trending-link";
import type { MusicAlbumResult, PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { MusicAlbumRow, PodcastShowRow, ScreenRow, SkeletonRows } from "./picker-rows";
import type { TrendingState } from "./use-trending";

export interface TrendingSectionsProps {
  trending: TrendingState;
  busy: boolean;
  onPickScreen: (item: ScreenResult) => void;
  onPickShow: (show: PodcastShowResult) => void;
  onPickAlbum: (album: MusicAlbumResult) => void;
}

export function TrendingSections({ trending, busy, onPickScreen, onPickShow, onPickAlbum }: TrendingSectionsProps) {
  if (trending.status === "error") return null;
  if (trending.status === "loading") {
    return (
      <section aria-label="本週熱門" aria-busy="true" className="pt-[22px]">
        <span className="text-eyebrow font-bold tracking-[0.24em] text-ink-600">本週熱門</span>
        <SkeletonRows />
      </section>
    );
  }
  const { payload } = trending;
  return (
    <>
      {payload.sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.key} aria-label={section.title} className="pt-[22px]">
            <span className="text-eyebrow font-bold tracking-[0.24em] text-ink-600">{section.title}</span>
            {payload.kind === "podcast"
              ? (section.items as PodcastShowResult[]).map((item) => (
                  <PodcastShowRow key={item.itunesId} item={item} query="" onPick={onPickShow} />
                ))
              : payload.kind === "music"
                ? (section.items as MusicAlbumResult[]).map((item) => (
                    <MusicAlbumRow key={item.itunesId} item={item} query="" busy={busy} onPick={onPickAlbum} />
                  ))
                : (section.items as ScreenResult[]).map((item) => (
                  <div key={`${item.kind}-${item.tmdbId}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-ink-200 [&>button]:border-b-0">
                    <ScreenRow item={item} query="" busy={busy} onPick={onPickScreen} />
                    <TrendingLink item={item} section={section.key} />
                  </div>
                ))}
          </section>
        ),
      )}
    </>
  );
}
