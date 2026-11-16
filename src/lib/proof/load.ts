/** 校樣頁資料載入（server only，走 service role） */

import { createAdminClient } from "@/lib/supabase/admin";
import { PLAYBACK_URL_TTL_SECONDS, signStoredAudioUrl } from "@/lib/audio/signed-url";
import { loadPenName } from "@/lib/me/pen-name";
import { loadEpisodeJournal } from "@/lib/journal/episode-link";
import type { EpisodeJournal } from "@/lib/journal/episode-byline";
import { WORK_COLUMNS, type Work } from "@/lib/works/format";
import {
  durationFromSegments,
  parseByline,
  parseStoredCandidates,
  parseVisibility,
  type Byline,
  type Visibility,
} from "./publish";
import { createSupabaseProofRepo } from "./supabase-repo";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProofEpisode {
  id: string;
  title: string;
  source: string;
  status: string;
  createdAt: string;
  audioUrl: string | null;
  workId: string | null;
  shareSlug: string | null;
  publishedAt: string | null;
  visibility: Visibility;
  byline: Byline;
  generateSocial: boolean;
  pullQuote: string | null;
  quoteCandidates: string[];
}

export interface ProofContent {
  id: string;
  body: string;
  originalBody: string;
}

export interface ProofTranscript {
  text: string;
  durationSeconds: number | null;
}

export interface ProofData {
  episode: ProofEpisode;
  content: ProofContent | null;
  transcript: ProofTranscript | null;
  work: Work | null;
  penName: string;
  /** 作品特輯既有的公開段數（不含這篇）；未綁作品為 null */
  workFeelingCount: number | null;
  /** 作者已發佈篇數（不含這篇） */
  authorPublishedCount: number;
  /** 連結的視聽日誌（署名時間差用）；直接說一段為 null */
  journal: EpisodeJournal | null;
}

interface EpisodeRow {
  id: string;
  title: string;
  source: string;
  status: string;
  created_at: string;
  audio_url: string | null;
  duration_seconds: number | null;
  work_id: string | null;
  share_slug: string | null;
  published_at: string | null;
  visibility: string;
  byline: string;
  generate_social: boolean;
  pull_quote: string | null;
  quote_candidates: unknown;
}

const EPISODE_COLUMNS =
  "id, title, source, status, created_at, audio_url, duration_seconds, work_id, share_slug, published_at, visibility, byline, generate_social, pull_quote, quote_candidates";

function toEpisode(row: EpisodeRow): ProofEpisode {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    audioUrl: row.audio_url,
    workId: row.work_id,
    shareSlug: row.share_slug,
    publishedAt: row.published_at,
    visibility: parseVisibility(row.visibility) ?? "public",
    byline: parseByline(row.byline) ?? "pen_name",
    generateSocial: row.generate_social,
    pullQuote: row.pull_quote,
    quoteCandidates: parseStoredCandidates(row.quote_candidates),
  };
}

/** 儲存桶是 private：原音換成簽名網址；簽不出來就不給播放器，校樣頁照常顯示 */
async function playbackUrl(
  supabase: ReturnType<typeof createAdminClient>,
  row: EpisodeRow,
): Promise<string | null> {
  if (!row.audio_url) return null;
  try {
    return await signStoredAudioUrl(supabase, row.audio_url, PLAYBACK_URL_TTL_SECONDS);
  } catch (err) {
    console.error("[proof] sign audio url failed", { episodeId: row.id, message: (err as Error).message });
    return null;
  }
}

/** 只載入 userId 自己的集數；別人的回 null（頁面 404） */
export async function loadProofData(episodeId: string, userId: string): Promise<ProofData | null> {
  if (!UUID_PATTERN.test(episodeId)) return null;
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("episodes")
    .select(EPISODE_COLUMNS)
    .eq("id", episodeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`讀取校樣失敗：${error.message}`);
  if (!row) return null;
  const episodeRow = row as EpisodeRow;
  const episode = { ...toEpisode(episodeRow), audioUrl: await playbackUrl(supabase, episodeRow) };

  const repo = createSupabaseProofRepo(supabase, userId);
  const [contentRes, transcriptRes, workRes, penName, authorPublishedCount, workFeelingCount, journal] =
    await Promise.all([
      supabase
        .from("contents")
        .select("id, body, original_body")
        .eq("episode_id", episodeId)
        .eq("platform", "blog")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("transcripts")
        .select("full_text, segments")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      episode.workId
        ? supabase.from("works").select(WORK_COLUMNS).eq("id", episode.workId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      loadPenName(userId),
      repo.countAuthorPublished(episodeId, episode.publishedAt),
      episode.workId
        ? repo.countListedWorkFeelings(episode.workId, episodeId, episode.publishedAt)
        : Promise.resolve(null),
      loadEpisodeJournal(episodeId),
    ]);

  if (contentRes.error) throw new Error(`讀取正文失敗：${contentRes.error.message}`);
  if (transcriptRes.error) throw new Error(`讀取逐字稿失敗：${transcriptRes.error.message}`);

  const content = contentRes.data
    ? {
        id: contentRes.data.id as string,
        body: contentRes.data.body as string,
        originalBody: (contentRes.data.original_body as string | null) ?? (contentRes.data.body as string),
      }
    : null;
  const transcript = transcriptRes.data
    ? {
        text: transcriptRes.data.full_text as string,
        durationSeconds:
          episodeRow.duration_seconds ?? durationFromSegments(transcriptRes.data.segments),
      }
    : null;

  return {
    episode,
    content,
    transcript,
    work: (workRes.data as Work | null) ?? null,
    penName,
    workFeelingCount,
    authorPublishedCount,
    journal,
  };
}
