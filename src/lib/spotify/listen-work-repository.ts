/** 收聽提醒 → 記一筆預選專輯（Q-64 C1）的接線（server only）：work_links、Spotify 讀專輯、iTunes 搜尋、建作品 */

import { saveAutoLink, spotifyAppDepsFromEnv } from "@/lib/links/spotify-auto-repository";
import { SPOTIFY_SOURCE } from "@/lib/links/spotify";
import { createAdminClient } from "@/lib/supabase/admin";
import { musicSearchDepsFromEnv, searchAlbums } from "@/lib/work-picker/itunes-music";
import { resolveWork } from "@/lib/work-picker/service";
import { PICKER_WORK_COLUMNS, type PickerWork } from "@/lib/work-picker/types";
import { getSpotifyAlbum } from "./api";
import { warnSpotify } from "./connection-repository";
import { resolveListenWork } from "./listen-work";

async function findLinkedWork(albumUrl: string): Promise<PickerWork | null> {
  const { data, error } = await createAdminClient()
    .from("work_links")
    .select(`work_id, works!inner(${PICKER_WORK_COLUMNS})`)
    .eq("source", SPOTIFY_SOURCE)
    .eq("status", "active")
    .eq("url", albumUrl)
    .eq("works.kind", "music")
    .limit(1);
  if (error) throw new Error(`讀取 Spotify 直連作品失敗：${error.message}`);
  const row = (data ?? [])[0] as { works: PickerWork | PickerWork[] } | undefined;
  if (!row) return null;
  return Array.isArray(row.works) ? (row.works[0] ?? null) : row.works;
}

export async function loadListenWork(albumId: string): Promise<PickerWork | null> {
  return resolveListenWork(albumId, {
    findLinkedWork,
    getAlbum: async (id) => {
      const app = spotifyAppDepsFromEnv();
      if (!app) throw new Error("沒有 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET");
      return getSpotifyAlbum(id, app);
    },
    searchItunes: (term) => searchAlbums(term, musicSearchDepsFromEnv()),
    createMusicWork: (itunesId) => resolveWork({ source: "music", itunesId }),
    saveAutoLink,
    warn: warnSpotify,
  });
}
