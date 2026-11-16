import Link from "next/link";
import { WorkCover } from "@/components/covers/work-cover";
import { CATEGORY_TAB_LABELS, type FeedEntry } from "@/lib/feed/entries";
import { formatDotDate } from "@/lib/share/article";
import { wavePath } from "@/lib/share/wave";
import { headlineScale, type HeadlineScale } from "@/lib/wide/layout";
import { isSquareCover, type WorkKind } from "@/lib/works/format";
import { WIDE_CONTAINER } from "./container";

/** 寬版目錄「本期焦點」封面故事（雛型 Main）：左海報、右大標＋引言＋兩欄內文開頭＋讀全文 */

const TITLE_SIZE: Record<HeadlineScale, string> = {
  short: "text-[clamp(56px,7vw,112px)] leading-[1.08] tracking-[0.04em]",
  medium: "text-[clamp(44px,4.6vw,72px)] leading-[1.15] tracking-[0.02em]",
  long: "text-[clamp(34px,3.2vw,52px)] leading-[1.3]",
};

function CoverFigure({ entry }: { entry: FeedEntry }) {
  const title = entry.workTitle ?? entry.title;
  const square = isSquareCover({ kind: entry.workKind as WorkKind });
  return (
    <figure className="m-0 w-[38%] max-w-[560px] flex-none">
      <WorkCover
        cover={{ kind: entry.workKind, title, posterUrl: entry.posterUrl }}
        size="xl"
        eager
        alt={entry.posterUrl ? `《${title}》${square ? "封面" : "海報"}` : ""}
        className={`w-full shadow-[18px_18px_0_var(--color-ember-tint-2)] ${square ? "aspect-square" : "aspect-[2/3]"}`}
      />
      <figcaption className="mt-[26px] text-caption tracking-[0.16em] text-ink-600">
        {entry.posterUrl ? `圖 · 《${title}》${square ? "封面" : "海報"}` : "圖 · 尚無海報，以字卡代替"}
      </figcaption>
    </figure>
  );
}

function Excerpt({ paragraphs }: { paragraphs: string[] }) {
  const [first, ...rest] = paragraphs;
  const chars = Array.from(first);
  return (
    <div className="mt-[22px] columns-2 gap-9 font-serif-tc text-prose leading-[1.95] text-ink-900 [column-rule:1px_solid_var(--color-ink-200)]">
      <p className="m-0">
        <span className="float-left pt-1.5 pr-2.5 text-[72px] leading-[0.9] font-black text-ink-950">{chars[0]}</span>
        {chars.slice(1).join("")}
      </p>
      {rest.map((text) => (
        <p key={text} className="mt-3 mb-0">
          {text}
        </p>
      ))}
    </div>
  );
}

export function WideCoverStory({ entry }: { entry: FeedEntry }) {
  const hasCover = Boolean(entry.workTitle || entry.posterUrl);
  const excerpt = entry.excerpt ?? [];
  return (
    <section aria-label="本期焦點" className={`${WIDE_CONTAINER} flex items-stretch gap-12 pt-12 pb-14`}>
      {hasCover ? <CoverFigure entry={entry} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-4 text-note font-bold tracking-[0.28em] text-ember-dark">
          <span>本期焦點</span>
          <span className="font-serif-tc text-[40px] font-normal tracking-normal tabular-nums">01</span>
          <span>{CATEGORY_TAB_LABELS[entry.category]}</span>
        </div>
        <h2 className={`mt-3 mb-0 font-serif-tc font-black text-ink-950 ${TITLE_SIZE[headlineScale(entry.title)]}`}>
          <Link href={entry.href} className="text-inherit no-underline hover:text-ember-deep">
            {entry.title}
          </Link>
        </h2>
        {entry.workTitle && entry.workTitle !== entry.title ? (
          <p className="mt-2 mb-0 text-lede tracking-[0.08em] text-ink-600">《{entry.workTitle}》</p>
        ) : null}
        {entry.quote ? (
          <blockquote className="mx-0 mt-9 mb-0 font-serif-tc text-[clamp(28px,3vw,44px)] leading-[1.5] text-ink-900">
            <span className="text-ember">「</span>
            {entry.quote}
            <span className="text-ember">」</span>
          </blockquote>
        ) : null}
        <svg aria-hidden="true" width="160" height="14" viewBox="0 0 160 14" fill="none" className="mt-3.5 block">
          <path className="stroke-ember" strokeWidth="2" d={wavePath({ y: 7, amplitude: 7, halfPeriod: 10, width: 160 })} />
        </svg>
        <div className="mt-7 flex flex-wrap gap-x-[18px] gap-y-1.5 border-t border-ink-900 pt-3 text-note text-ink-700">
          {entry.author ? <span className="font-bold text-ink-950">文／{entry.author}</span> : null}
          <span className="tabular-nums">{formatDotDate(entry.createdAt)}</span>
        </div>
        {excerpt.length > 0 ? <Excerpt paragraphs={excerpt} /> : null}
        <Link
          href={entry.href}
          aria-label={`讀全文：${entry.title}`}
          className="mt-auto inline-flex min-h-11 items-center self-end pt-6 text-lede font-bold tracking-[0.16em] text-ember-dark no-underline hover:text-ember-deep"
        >
          讀全文 →
        </Link>
      </div>
    </section>
  );
}
