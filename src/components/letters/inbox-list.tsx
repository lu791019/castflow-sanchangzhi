/** 來信列表（P3 來信 A）：未讀燒橙點＋ink-950，已讀 ink-600；已刊登小章 11px −3°；空（D）是淡線信封 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { inboxStatLine, letterDay, letterNote, type LetterStatus } from "@/lib/letters/format";
import { Envelope } from "./envelope";

export interface InboxRow {
  id: string;
  senderName: string;
  articleTitle: string;
  body: string;
  status: LetterStatus;
  hasReply: boolean;
  unread: boolean;
  createdAt: string;
}

function Row({ row }: { row: InboxRow }) {
  const tone = row.unread ? "text-ink-950" : "text-ink-600";
  const note = letterNote(row.status, row.hasReply);
  return (
    <Link
      href={`/me/letters/${row.id}`}
      className="grid w-full grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 border-b border-ink-200 py-4 text-left text-inherit no-underline active:bg-paper-2"
    >
      <PenSeal penName={row.senderName} size={40} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-h-5 items-center gap-1.5">
          {row.unread ? <span aria-hidden="true" className="block size-1.5 flex-none rounded-full bg-ember" /> : null}
          <span className={`flex-1 text-note font-bold ${tone}`}>
            {row.senderName}
            {row.unread ? <span className="sr-only">，未讀</span> : null}
          </span>
          <span className="text-caption text-ink-600 tabular-nums">{letterDay(row.createdAt)}</span>
        </span>
        <span className="block truncate font-serif-tc text-caption text-ink-600">致〈{row.articleTitle}〉</span>
        <span className={`line-clamp-2 font-serif-tc text-lede leading-[27px] tracking-[0.02em] ${tone}`}>{row.body}</span>
        {note ? (
          <span className="mt-1.5 flex items-center gap-2">
            {row.status === "published" ? (
              <span className="flex h-5 -rotate-3 items-center rounded-[2px] border border-ember-dark px-1.5 text-eyebrow font-bold tracking-[0.16em] text-ember-dark">
                已刊登
              </span>
            ) : null}
            <span className="text-eyebrow text-ink-600">{note}</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function InboxList({ rows }: { rows: InboxRow[] }) {
  const unread = rows.filter((row) => row.unread).length;
  return (
    <section className="mx-4 mt-5">
      <h1 className="m-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">
        {inboxStatLine(rows.length, unread)}
      </h1>
      <p className="mt-2.5 mb-0 border-t border-ink-950 pt-2 text-eyebrow leading-[1.6] tracking-[0.04em] text-ink-600">
        只有你看得到這裡的信。要不要刊登，由你決定。
      </p>
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </section>
  );
}

export function InboxEmpty() {
  return (
    <div className="flex flex-col items-center px-8 pt-[104px] text-center">
      <Envelope empty />
      <h1 className="mt-7 mb-0 font-serif-tc text-section leading-[1.6] font-bold text-ink-950">還沒有人來信。</h1>
      <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">文章被讀得越多，信就會來。</p>
      <Link href="/me" className="mt-5 flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
        翻翻自己的專欄 →
      </Link>
    </div>
  );
}
