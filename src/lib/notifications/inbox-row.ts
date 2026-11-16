/** 收件匣 DB 列（notifications + 嵌入 journal_entries、works）→ InboxSource（純函式） */

import { JOURNAL_STATUSES, isVenue, type JournalStatus } from "@/lib/journal/types";
import { single, toWork, type Embed, type WorkEmbed } from "@/lib/journal/view-row";
import type { InboxEntrySource, InboxSource } from "./inbox";

interface EntryEmbed {
  id: string;
  experienced_at: string;
  venue: string;
  status: string;
  work_title_fallback: string | null;
  works?: Embed<WorkEmbed>;
}

export interface InboxRow {
  id: string;
  kind?: string;
  /** migration 041：listen_prompt 點了去哪 */
  url?: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  journal_entries?: Embed<EntryEmbed>;
}

const STATUSES: readonly string[] = JOURNAL_STATUSES;
const KNOWN_KINDS: readonly string[] = ["say_reminder", "plan_reminder", "settle_prompt", "listen_prompt"];

function toEntry(embed: EntryEmbed | null): InboxEntrySource | null {
  if (!embed || !isVenue(embed.venue) || !STATUSES.includes(embed.status)) return null;
  return {
    id: embed.id,
    experiencedAt: embed.experienced_at,
    venue: embed.venue,
    status: embed.status as JournalStatus,
    titleFallback: embed.work_title_fallback,
    work: toWork(single(embed.works)),
  };
}

export function toInboxSource(row: InboxRow): InboxSource {
  return {
    id: row.id,
    kind: KNOWN_KINDS.includes(row.kind ?? "") ? (row.kind as InboxSource["kind"]) : "say_reminder",
    url: row.url ?? null,
    title: row.title,
    body: row.body,
    read_at: row.read_at,
    created_at: row.created_at,
    entry: toEntry(single(row.journal_entries)),
  };
}
