/** 日誌的三種列：展開某天（B）、還沒說的（A）、清單檢視（C） */

import Link from "next/link";
import { VenueIcon } from "@/components/journal/icons";
import { sayUrlFor } from "@/lib/journal/due";
import { logicalDateLabel } from "@/lib/journal/wording";
import { journalHref } from "./journal-href";
import { taipeiDateKey } from "@/lib/journal/time";
import { entryByline, entryMeta, entryTime, entryTitle, type JournalViewEntry } from "@/lib/journal/view";
import { UpcomingLinkButton } from "@/components/links/upcoming-link";
import type { WorkLink } from "@/lib/links/types";
import { HIT_Y4 } from "@/components/journal/hit-area";
import { SkipButton } from "./journal-actions";

/** 導覽 4d 指「剛記的那筆」：最新一筆的列帶 data-tour */
const LATEST_TOUR = "journal-latest-entry";

const SAY_BUTTON = `${HIT_Y4} flex min-h-9 items-center rounded-control border border-ink-950 px-3 text-note font-bold text-ink-950 no-underline`;

function titleTone(entry: JournalViewEntry): string {
  return entry.status === "skipped" ? "text-entry-skipped-title" : "text-ink-950";
}

/** B：展開某天的一筆；說成了文章／還沒說（說說看＋只記不說）／只記不說 */
export function DayRow({ entry, latest = false }: { entry: JournalViewEntry; latest?: boolean }) {
  return (
    <div data-tour={latest ? LATEST_TOUR : undefined} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2 border-b border-ink-200 py-4">
      <span className="flex flex-col items-start gap-1.5">
        <span className="text-caption text-ink-700 tabular-nums">{entryTime(entry)}</span>
        <span className="text-ink-600">
          <VenueIcon venue={entry.venue} size={18} strokeWidth={1.6} />
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={`font-serif-tc text-prose leading-normal font-bold ${titleTone(entry)}`}>{entryTitle(entry)}</span>
        <span className="text-eyebrow text-ink-600">{entryMeta(entry)}</span>
        {entry.status === "said" && entry.article ? (
          <Link href={entry.article.href} className="mt-0.5 flex min-h-8 flex-col gap-0.5 no-underline">
            <span className="text-note font-bold text-ember-dark">說成了一篇 →</span>
            <span className="text-eyebrow text-ink-600">{entryByline(entry)}</span>
          </Link>
        ) : null}
        {entry.status === "said" && !entry.article ? (
          <span className="text-caption text-ink-700">說過了</span>
        ) : null}
        {entry.status === "recorded" ? (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-caption text-ink-700">還沒說</span>
            <Link href={sayUrlFor(entry.id)} className={`${SAY_BUTTON} px-3.5`}>
              說說看
            </Link>
            <SkipButton entryId={entry.id} />
          </div>
        ) : null}
        {entry.status === "skipped" ? <span className="text-caption text-entry-skipped-status">只記不說</span> : null}
        {entry.status === "planned" ? <span className="text-caption text-ember-dark">計畫中・當天早上提醒</span> : null}
      </div>
    </div>
  );
}

/** 接下來：排好的計畫，點日期跳到那一天；右側次鈕「去哪買票／在哪看／官網」（散場之前 C） */
export function UpcomingRow({ entry, link = null, tour }: { entry: JournalViewEntry; link?: WorkLink | null; tour?: string }) {
  const at = new Date(entry.experiencedAt);
  const dateKey = taipeiDateKey(at);
  return (
    <div data-tour={tour} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b border-ink-200">
      <Link
        href={journalHref({ month: dateKey.slice(0, 7), view: "cal", day: dateKey })}
        scroll={false}
        className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-2 py-3.5 no-underline"
      >
        <span className="flex flex-col">
          <span className="text-caption text-ink-700 tabular-nums">{logicalDateLabel(at)}</span>
          <span className="text-caption text-ink-600 tabular-nums">{entryTime(entry)}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-serif-tc text-lede font-bold text-ink-950">{entryTitle(entry)}</span>
          <span className="text-eyebrow text-ink-600">{entryMeta(entry)}</span>
        </span>
      </Link>
      {link ? <UpcomingLinkButton link={link} /> : null}
    </div>
  );
}

/** A：月曆下方「還沒說的」 */
export function PendingRow({ entry, latest = false }: { entry: JournalViewEntry; latest?: boolean }) {
  return (
    <div data-tour={latest ? LATEST_TOUR : undefined} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-ink-200 py-3.5">
      <span className="text-caption text-ink-700 tabular-nums">{logicalDateLabel(new Date(entry.experiencedAt))}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-serif-tc text-lede font-bold text-ink-950">{entryTitle(entry)}</span>
        <span className="text-eyebrow text-ink-600">{entryMeta(entry)}</span>
      </span>
      <Link href={sayUrlFor(entry.id)} className={SAY_BUTTON}>
        說說看
      </Link>
    </div>
  );
}

/** C：清單檢視的一筆 */
export function ListRow({ entry, latest = false }: { entry: JournalViewEntry; latest?: boolean }) {
  return (
    <div data-tour={latest ? LATEST_TOUR : undefined} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-ink-50 py-3">
      <span className="text-caption text-ink-700 tabular-nums">{entryTime(entry)}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`font-serif-tc text-lede font-bold ${titleTone(entry)}`}>{entryTitle(entry)}</span>
        <span className="flex items-center gap-1 text-eyebrow text-ink-600">
          <VenueIcon venue={entry.venue} size={12} strokeWidth={1.8} />
          {entryMeta(entry)}
        </span>
      </span>
      {entry.status === "said" && entry.article ? (
        <Link href={entry.article.href} className="flex min-h-11 items-center text-caption font-bold text-ember-dark no-underline">
          說成了一篇 →
        </Link>
      ) : null}
      {entry.status === "recorded" ? (
        <Link href={sayUrlFor(entry.id)} className={`${SAY_BUTTON} text-caption`}>
          說說看
        </Link>
      ) : null}
      {entry.status === "skipped" ? <span className="text-caption text-entry-skipped-status">只記不說</span> : null}
      {entry.status === "planned" ? <span className="text-caption text-ember-dark">計畫中</span> : null}
      {entry.status === "said" && !entry.article ? <span className="text-caption text-ink-700">說過了</span> : null}
    </div>
  );
}
