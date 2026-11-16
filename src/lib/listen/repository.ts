/** Podcast 單集閱讀頁資料存取（server only，走 service role） */

import { createAdminClient } from "@/lib/supabase/admin";
import { createReadingRepo, loadReading, type ReadingView } from "@/lib/reading";
import { listWorkFeelings } from "@/lib/works/repository";
import {
  fromBilingual,
  fromTranscript,
  type DisplaySegment,
} from "./display";
import { isReadable } from "./progress";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListenShow {
  title: string | null;
  imageUrl: string | null;
  author: string | null;
  feedUrl: string | null;
}

export interface ListenWork {
  slug: string;
  title: string;
  podcastShow: string | null;
}

export interface ListenEpisode {
  id: string;
  title: string;
  status: string;
  audioUrl: string | null;
  durationSeconds: number | null;
  airedAt: string | null;
  episodeNumber: number | null;
  seasonNumber: number | null;
  /** 單集 author 優先，退回節目 author（照實顯示，不寫主持人） */
  author: string | null;
  show: ListenShow;
  work: ListenWork | null;
}

export interface ListenPageData {
  episode: ListenEpisode;
  reading: ReadingView;
  hasTranscript: boolean;
  readable: boolean;
  segments: DisplaySegment[];
  feelingCount: number;
}

interface EpisodeRow {
  id: string;
  title: string;
  source: string;
  status: string;
  audio_url: string | null;
  duration_seconds: number | null;
  aired_at: string | null;
  episode_number: number | null;
  season_number: number | null;
  author: string | null;
  work_id: string | null;
  feeds: { title: string | null; image_url: string | null; author: string | null; url: string } | null;
  works: { id: string; slug: string; title: string; podcast_show: string | null } | null;
}

const EPISODE_SELECT =
  "id, title, source, status, audio_url, duration_seconds, aired_at, episode_number, season_number, author, work_id, feeds(title, image_url, author, url), works(id, slug, title, podcast_show)";

function toEpisode(row: EpisodeRow): ListenEpisode {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    audioUrl: row.audio_url,
    durationSeconds: row.duration_seconds,
    airedAt: row.aired_at,
    episodeNumber: row.episode_number,
    seasonNumber: row.season_number,
    author: row.author ?? row.feeds?.author ?? null,
    show: {
      title: row.feeds?.title ?? row.works?.podcast_show ?? null,
      imageUrl: row.feeds?.image_url ?? null,
      author: row.feeds?.author ?? null,
      feedUrl: row.feeds?.url ?? null,
    },
    work: row.works
      ? { slug: row.works.slug, title: row.works.title, podcastShow: row.works.podcast_show }
      : null,
  };
}

/** 單集閱讀頁：只開放 RSS 來源的 podcast 單集；找不到回 null（頁面 404） */
export async function loadListenPage(episodeId: string): Promise<ListenPageData | null> {
  if (!UUID_PATTERN.test(episodeId)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select(EPISODE_SELECT)
    .eq("id", episodeId)
    .maybeSingle();
  if (error) {
    console.error("[listen] load episode failed", { episodeId, message: error.message });
    throw new Error("讀取單集失敗");
  }
  const row = data as unknown as EpisodeRow | null;
  if (!row || row.source !== "rss") return null;

  const readingRepo = createReadingRepo();
  const [reading, transcript, feelings] = await Promise.all([
    loadReading(readingRepo, episodeId),
    readingRepo.getLatestTranscript(episodeId),
    row.works ? listWorkFeelings(row.works.id) : Promise.resolve([]),
  ]);

  const hasTranscript = transcript !== null;
  const readable = isReadable({ hasTranscript, readingStatus: reading.status });
  const segments = !readable
    ? []
    : reading.status === "ready"
      ? fromBilingual(reading.segments)
      : fromTranscript(transcript?.segments ?? []);

  return {
    episode: toEpisode(row),
    reading,
    hasTranscript,
    readable,
    segments,
    feelingCount: feelings.length,
  };
}

/** 作品特輯（podcast_episode）→ 對應的 RSS 單集（閱讀頁入口）；沒有回 null */
export async function findListenEpisodeIdForWork(workId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("id")
    .eq("work_id", workId)
    .eq("source", "rss")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[listen] findListenEpisodeIdForWork failed", { workId, message: error.message });
    return null;
  }
  return data?.id ?? null;
}

export function listenHref(episodeId: string, mode?: "read" | "scan"): string {
  return `/episodes/${episodeId}/read${mode ? `?mode=${mode}` : ""}`;
}
