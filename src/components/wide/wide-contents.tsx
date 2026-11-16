import Link from "next/link";
import { WorkCover } from "@/components/covers/work-cover";
import { CATEGORY_TAB_LABELS, feedBylineText, type FeedEntry } from "@/lib/feed/entries";
import { isSquareCover, type WorkKind } from "@/lib/works/format";
import { WIDE_CONTAINER } from "./container";

/** 寬版目錄「本期目次」（auto-fit 多欄、大號序號）與「今晚的一句」滿版深色帶（雛型 Main） */

function ContentsItem({ entry, index }: { entry: FeedEntry; index: number }) {
  const hasCover = Boolean(entry.workTitle || entry.posterUrl);
  const square = isSquareCover({ kind: entry.workKind as WorkKind });
  const byline = feedBylineText(entry.workTitle, entry.author);
  return (
    <Link
      href={entry.href}
      className="p4-press flex gap-[18px] border-t-2 border-ink-950 py-5 text-inherit no-underline active:bg-paper"
    >
      <span className="font-serif-tc text-[56px] leading-none text-ember tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <span className="block text-caption font-bold tracking-[0.24em] text-ember-dark">{CATEGORY_TAB_LABELS[entry.category]}</span>
        <h3 className="mt-1 mb-0 font-serif-tc text-section leading-[1.4] font-bold text-ink-950">{entry.title}</h3>
        {entry.quote ? <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">「{entry.quote}」</p> : null}
        {byline ? <span className="mt-2 block text-caption text-ink-600">— {byline}</span> : null}
      </div>
      {hasCover ? (
        <WorkCover
          cover={{ kind: entry.workKind, title: entry.workTitle ?? entry.title, posterUrl: entry.posterUrl }}
          size="sm"
          className={`flex-none ${square ? "size-[88px]" : "h-[108px] w-[72px]"}`}
        />
      ) : null}
    </Link>
  );
}

export function WideContents({ entries }: { entries: FeedEntry[] }) {
  return (
    <section aria-label="本期目次" className="border-y border-ink-950 bg-paper-2">
      <div className={`${WIDE_CONTAINER} pt-9 pb-11`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 font-serif-tc text-[32px] font-black tracking-[0.12em] text-ink-950">本期目次</h2>
          <span className="text-note tracking-[0.24em] text-ink-600">CONTENTS · 依發表時間</span>
        </div>
        <div className="p4-stagger mt-6 grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-x-10">
          {entries.map((entry, index) => (
            <ContentsItem key={entry.id} entry={entry} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function WideTonightBand({ quote, fromTitle }: { quote: string; fromTitle: string }) {
  return (
    <section aria-label="今晚的一句" className="p4-inverse p4-band bg-ink-950 text-paper">
      <div className={`${WIDE_CONTAINER} flex items-center gap-x-16 gap-y-6 py-[72px]`}>
        <span className="flex-none text-note tracking-[0.32em] text-ember-soft">今晚的一句</span>
        <blockquote className="m-0 min-w-0 flex-1 font-serif-tc text-[clamp(32px,3.6vw,56px)] leading-[1.4] font-semibold">「{quote}」</blockquote>
        <span className="flex-none text-lede text-ink-300">— 摘自〈{fromTitle}〉</span>
      </div>
    </section>
  );
}
