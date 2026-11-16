/**
 * 說一段頁的作品卡（UX-07）：第一張是「剛記、還沒說」的那筆日誌，記一筆→說一段才接得上。
 * 順序：深連結預帶（/say?journal=、?work=）＞ 最近還沒說的日誌 ＞ 最近說過、有綁作品的文章。
 * 沒綁作品的舊錄音（預設標題「散場隨筆」）不當作品卡。
 */

import type { RecentWork } from "@/app/(social)/say/say-stage";
import { KIND_LABELS, workVerb, type Work } from "@/lib/works/format";

export interface RecentEpisodeRow {
  id: string;
  title: string;
  created_at: string;
  work_id: string | null;
  works: Pick<Work, "kind" | "title" | "podcast_show" | "poster_url"> | null;
}

export function episodeCard(row: RecentEpisodeRow): RecentWork | null {
  const work = row.works;
  if (!row.work_id || !work) return null;
  const podcast = work.kind === "podcast_episode";
  return {
    id: row.id,
    workId: row.work_id,
    title: row.title,
    workTitle: podcast && work.podcast_show ? work.podcast_show : work.title,
    categoryLabel: KIND_LABELS[work.kind],
    createdAt: row.created_at,
    verb: workVerb(work),
    posterUrl: work.poster_url,
  };
}

function sameCard(a: RecentWork, b: RecentWork): boolean {
  if (a.journalId && a.journalId === b.journalId) return true;
  return a.id === b.id || Boolean(a.workId && a.workId === b.workId);
}

export function buildSayCards(input: {
  prefill: RecentWork | null;
  unsaid: RecentWork | null;
  recent: readonly RecentWork[];
}): RecentWork[] {
  const ordered = [input.prefill, input.unsaid, ...input.recent].filter((card): card is RecentWork => card !== null);
  return ordered.reduce<RecentWork[]>(
    (kept, card) => (kept.some((existing) => sameCard(existing, card)) ? kept : [...kept, card]),
    [],
  );
}
