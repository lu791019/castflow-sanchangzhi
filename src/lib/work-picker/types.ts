/** 作品選擇器：search / episodes / create 三個端點與 UI 共用的型別 */

import type { Work, WorkKind } from "@/lib/works/format";

/** 選擇器的類型 tab；podcast 對應 works.kind = podcast_episode、music 對應 music（專輯） */
export type PickerKind = "movie" | "series" | "podcast" | "music";

export const PICKER_KINDS: readonly PickerKind[] = ["movie", "series", "podcast", "music"];

export const PICKER_KIND_LABELS: Record<PickerKind, string> = {
  movie: "電影",
  series: "影集",
  podcast: "Podcast",
  music: "音樂",
};

/** 電影／影集搜尋列（TMDB search 端點拿得到的欄位；導演要點選後才補） */
export interface ScreenResult {
  kind: "movie" | "series";
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  region: string | null;
  posterUrl: string | null;
  /** 上映日／首播日（YYYY-MM-DD）；TMDB 沒給就 null */
  releaseDate: string | null;
  /** 自家已發佈公開的感受數；0 不顯示 */
  feelingCount: number;
}

/** Podcast 節目（iTunes Search）；同名節目多，要帶封面＋作者＋集數 */
export interface PodcastShowResult {
  kind: "podcast";
  itunesId: number;
  name: string;
  artist: string | null;
  trackCount: number | null;
  artworkUrl: string | null;
  feedUrl: string;
}

/** 音樂專輯（iTunes Search entity=album）；單曲先不做（Apple 的「- Single」也是一張專輯，照列） */
export interface MusicAlbumResult {
  kind: "music";
  itunesId: number;
  title: string;
  artist: string | null;
  year: number | null;
  trackCount: number | null;
  artworkUrl: string | null;
  /** 自家已發佈公開的感受數；0 不顯示 */
  feelingCount: number;
}

export type SearchResult = ScreenResult | PodcastShowResult | MusicAlbumResult;

/** Podcast 第二層：節目 RSS 的單集 */
export interface PodcastEpisodeOption {
  guid: string;
  title: string;
  publishedAt: string | null;
  episodeNumber: number | null;
  seasonNumber: number | null;
  durationSeconds: number | null;
  feelingCount: number;
}

export interface PodcastEpisodesPayload {
  show: {
    title: string | null;
    author: string | null;
    imageUrl: string | null;
    feedUrl: string;
  };
  episodes: PodcastEpisodeOption[];
}

/** POST /api/works 的四種輸入 */
export type CreateWorkInput =
  | { source: "tmdb"; kind: "movie" | "series"; tmdbId: number }
  | { source: "music"; itunesId: number }
  | { source: "podcast"; feedUrl: string; guid: string; itunesId: number | null }
  | {
      source: "manual";
      kind: WorkKind;
      title: string;
      /** 演出／展覽才有：場地、日期（YYYY-MM-DD） */
      venue?: string | null;
      eventDate?: string | null;
    };

/** works 表（含 migration 012 新增的 podcast 對應欄位） */
export interface PickerWork extends Work {
  feed_url: string | null;
  itunes_id: number | null;
  episode_guid: string | null;
}

export const PICKER_WORK_COLUMNS =
  "id, kind, title, original_title, year, region, credit, poster_url, tmdb_id, podcast_show, episode_number, synopsis, slug, issue_no, created_at, feed_url, itunes_id, episode_guid";
