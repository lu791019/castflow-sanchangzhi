/** DB 列（journal_entries + 嵌入 works、episodes）→ 日誌檢視模型（純函式） */

import type { WorkKind } from "@/lib/works/format";
import { isVenue, JOURNAL_STATUSES, type JournalStatus } from "./types";
import type { JournalViewArticle, JournalViewEntry, JournalViewWork } from "./view";

export const JOURNAL_VIEW_SELECT =
  "id, experienced_at, venue, status, companions, work_title_fallback, works(kind, title, podcast_show, episode_number, poster_url), episodes(id, share_slug, published_at, created_at, source)";

export interface WorkEmbed {
  kind: string;
  title: string;
  podcast_show: string | null;
  episode_number: number | null;
  poster_url: string | null;
}

interface EpisodeEmbed {
  id: string;
  share_slug: string | null;
  published_at: string | null;
  created_at: string;
  source: string | null;
}

export type Embed<T> = T | T[] | null | undefined;

export interface JournalViewRow {
  id: string;
  experienced_at: string;
  venue: string;
  status: string;
  companions: string | null;
  work_title_fallback: string | null;
  works?: Embed<WorkEmbed>;
  episodes?: Embed<EpisodeEmbed>;
}

/** PostgREST 多對一嵌入：物件；型別推斷有時給陣列，兩者都收 */
export function single<T>(value: Embed<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function toWork(embed: WorkEmbed | null): JournalViewWork | null {
  if (!embed) return null;
  return {
    kind: embed.kind as WorkKind,
    title: embed.title,
    podcast_show: embed.podcast_show,
    episode_number: embed.episode_number,
    poster_url: embed.poster_url,
  };
}

/** 已發佈且有分享網址 → 分享頁；否則回校樣頁 */
export function articleOf(episode: EpisodeEmbed | null): JournalViewArticle | null {
  if (!episode) return null;
  const href =
    episode.published_at && episode.share_slug
      ? `/s/${encodeURIComponent(episode.share_slug)}`
      : `/proof/${episode.id}`;
  return { href, saidAt: episode.created_at, typed: episode.source === "text" };
}

const STATUSES: readonly JournalStatus[] = JOURNAL_STATUSES;

/** 不合法的列（場域或狀態不在清單）回 null，由呼叫端略過並記 log */
export function toJournalViewEntry(row: JournalViewRow): JournalViewEntry | null {
  if (!isVenue(row.venue) || !STATUSES.includes(row.status as JournalStatus)) return null;
  const status = row.status as JournalStatus;
  return {
    id: row.id,
    experiencedAt: row.experienced_at,
    venue: row.venue,
    status,
    companions: row.companions,
    titleFallback: row.work_title_fallback,
    work: toWork(single(row.works)),
    // 「說成了一篇」只認已標 said 的；連上文章但還沒存校樣仍算「還沒說」
    article: status === "said" ? articleOf(single(row.episodes)) : null,
  };
}
