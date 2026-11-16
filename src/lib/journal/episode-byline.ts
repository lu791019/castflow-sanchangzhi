/**
 * 文章署名的時刻標籤（校樣頁、分享頁共用）：
 * - 有連結視聽日誌 → 時間差寫法「10.07 晚上看完 · 隔天說的」（byline.ts）
 * - 沒有（直接說一段）→ 原本的錄下時刻（recordedAtLabel）
 */

import { recordedAtLabel } from "@/lib/proof/publish";
import { formatJournalByline } from "./byline";
import { defaultVerb } from "./remind";
import { isVenue, type Venue } from "./types";

export interface EpisodeJournal {
  journalId: string;
  experiencedAt: string;
  venue: Venue;
  /** 看完／聽完 */
  verb: string;
}

export interface EpisodeJournalRow {
  id: string;
  experienced_at: string;
  venue: string;
  works?: { kind?: string | null } | Array<{ kind?: string | null }> | null;
}

function workKindOf(row: EpisodeJournalRow): string | null {
  const works = Array.isArray(row.works) ? row.works[0] : row.works;
  return works?.kind ?? null;
}

/** DB 列 → 署名所需資料；資料不合法回傳 null（退回錄下時刻） */
export function toEpisodeJournal(row: EpisodeJournalRow | null | undefined): EpisodeJournal | null {
  if (!row || !isVenue(row.venue) || Number.isNaN(new Date(row.experienced_at).getTime())) {
    return null;
  }
  const kind = workKindOf(row);
  const verb = kind === "podcast_episode" || kind === "music" ? "聽完" : defaultVerb(row.venue);
  return { journalId: row.id, experiencedAt: row.experienced_at, venue: row.venue, verb };
}

/** 日誌時間差署名；saidAt 不合法回傳空字串。typed（用打的）寫「寫的」 */
export function journalBylineLabel(journal: EpisodeJournal, saidAt: string, typed = false): string {
  try {
    return formatJournalByline({
      experiencedAt: journal.experiencedAt,
      venue: journal.venue,
      saidAt,
      verb: journal.verb,
      typed,
    });
  } catch {
    return "";
  }
}

export interface EpisodeTimeInput {
  createdAt: string;
  source: string;
  journal: EpisodeJournal | null;
}

/** 校樣頁署名行的時刻：有日誌用時間差，否則維持錄下時刻 */
export function episodeTimeLabel({ createdAt, source, journal }: EpisodeTimeInput): string {
  const fromJournal = journal ? journalBylineLabel(journal, createdAt, source === "text") : "";
  return fromJournal || recordedAtLabel(createdAt, source);
}
