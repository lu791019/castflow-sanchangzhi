import Link from "next/link";
import { CATEGORY_LABELS, feedBylineText, type FeedEntry } from "@/lib/feed/entries";
import { wavePath } from "@/lib/share/wave";
import { WorkCover } from "@/components/covers/work-cover";
import { isSquareCover, type WorkKind } from "@/lib/works/format";

/** 目錄條目（手機單欄與桌機三欄共用） */

function EyebrowTag({ entry }: { entry: FeedEntry }) {
  const tone = entry.category === "screen" ? "text-ember-dark" : "text-ink-700";
  return <span className={`text-eyebrow font-bold tracking-[0.2em] ${tone}`}>{CATEGORY_LABELS[entry.category]}</span>;
}

/** 「《作品》 — 署名」：署名是作者筆名或「匿名」（UX-23，不再一律「作者」） */
function EntryByline({ entry }: { entry: FeedEntry }) {
  const text = feedBylineText(entry.workTitle, entry.author);
  return text ? <span className="text-caption text-ink-600">{text}</span> : null;
}

/** 條目的作品封面：有海報放海報，沒有走字卡（封面補齊）；沒綁作品也沒片名就不放 */
function EntryCover({ entry, size, className, entering = false }: { entry: FeedEntry; size: "xs" | "sm" | "md" | "lg"; className: string; entering?: boolean }) {
  return (
    <WorkCover
      cover={{ kind: entry.workKind, title: entry.workTitle ?? "散場之後", posterUrl: entry.posterUrl }}
      size={size}
      eager={entering}
      className={`${entering ? "p4-poster-in" : ""} ${className}`}
    />
  );
}

function hasCover(entry: FeedEntry): boolean {
  return Boolean(entry.workTitle || entry.posterUrl);
}

/** 各類別封面比例統一（Q-61）：Podcast、音樂 1:1，其他 2:3 */
function isSquare(entry: FeedEntry): boolean {
  return isSquareCover({ kind: entry.workKind as WorkKind });
}

/** 手機頭條 */
export function LeadEntry({ entry }: { entry: FeedEntry }) {
  return (
    <Link
      href={entry.href}
      className={`p4-press grid gap-x-4 border-b border-ink-200 py-6 text-inherit no-underline active:bg-paper-2 ${
        hasCover(entry) ? "grid-cols-[minmax(0,1fr)_96px]" : "grid-cols-1"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif-tc text-note text-ember-dark tabular-nums">01</span>
          <EyebrowTag entry={entry} />
        </div>
        <h2 className="m-0 font-serif-tc text-section leading-[1.45] font-bold text-ink-950">{entry.title}</h2>
        {entry.quote ? <p className="p4-quote-in m-0 text-note leading-[1.75] text-ink-700">「{entry.quote}」</p> : null}
        <EntryByline entry={entry} />
      </div>
      {hasCover(entry) ? (
        <EntryCover entry={entry} size="md" entering className={`mt-[26px] w-24 ${isSquare(entry) ? "h-24" : "h-36"}`} />
      ) : null}
    </Link>
  );
}

/**
 * 平板與桌機的「本期焦點」：768／1024 為橫卡（封面左、文字右），1280 為左欄直式大卡（封面上、文字下）
 */
export function FocusEntry({ entry }: { entry: FeedEntry }) {
  return (
    <Link
      href={entry.href}
      className="p4-press grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-6 border-b border-ink-950 pb-7 text-inherit no-underline xl:grid-cols-1 xl:gap-y-6 xl:border-b-0"
    >
      <div className="xl:mx-auto xl:w-[280px]">
        <EntryCover entry={entry} size="lg" entering className={`w-full ${isSquare(entry) ? "aspect-square" : "aspect-[2/3]"}`} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-eyebrow font-bold tracking-[0.2em] text-ember-dark">本期焦點</span>
          <span className="font-serif-tc text-note text-ember-dark tabular-nums">01</span>
        </div>
        <EyebrowTag entry={entry} />
        <h2 className="m-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950 xl:text-headline xl:leading-[1.45]">{entry.title}</h2>
        {entry.quote ? <p className="p4-quote-in m-0 font-serif-tc text-lede leading-[1.75] text-ink-950">「{entry.quote}」</p> : null}
        <div className="mt-auto flex items-center justify-between border-t border-ink-200 pt-3">
          <EntryByline entry={entry} />
          <span className="text-note font-bold text-ember-dark">讀全文 →</span>
        </div>
      </div>
    </Link>
  );
}

export function ListEntry({ entry, index }: { entry: FeedEntry; index: number }) {
  return (
    <Link
      href={entry.href}
      className={`p4-press grid gap-x-3 border-b border-ink-200 py-5 text-inherit no-underline active:bg-paper-2 ${
        hasCover(entry) ? "grid-cols-[28px_minmax(0,1fr)_48px]" : "grid-cols-[28px_minmax(0,1fr)]"
      }`}
    >
      <span className="pt-px font-serif-tc text-note text-ink-600 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      <div className="flex min-w-0 flex-col gap-2">
        <EyebrowTag entry={entry} />
        <h2 className="m-0 font-serif-tc text-prose leading-[1.55] font-bold text-ink-950">{entry.title}</h2>
        {entry.quote ? <p className="m-0 text-note leading-[1.75] text-ink-700">「{entry.quote}」</p> : null}
        <EntryByline entry={entry} />
      </div>
      {hasCover(entry) ? <EntryCover entry={entry} size={isSquare(entry) ? "xs" : "sm"} className={`w-12 ${isSquare(entry) ? "h-12" : "h-[72px]"}`} /> : null}
    </Link>
  );
}

export function TonightQuote({ quote, fromTitle }: { quote: string; fromTitle: string }) {
  return (
    <aside className="mt-8 mb-2 border-y border-ink-950 pt-[22px] pb-5 lg:col-span-full">
      <span className="text-eyebrow tracking-[0.24em] text-ink-600">今晚的一句</span>
      <p className="mt-2.5 mb-0 font-serif-tc text-quote leading-[1.6] font-semibold text-ink-950">
        <span className="text-ember">「</span>
        {quote}
      </p>
      <div aria-hidden="true" className="mt-3 h-3 w-[110px] overflow-hidden">
        <svg width="180" height="12" viewBox="0 0 180 12" fill="none" className="block">
          <path className="shell-w-slow stroke-ember" strokeWidth="1.4" d={wavePath({ y: 6, amplitude: 5, halfPeriod: 15, width: 180 })} />
        </svg>
      </div>
      <span className="mt-2 block text-caption text-ink-600">— 摘自〈{fromTitle}〉</span>
    </aside>
  );
}

export function EmptyFeed() {
  return (
    <div className="border-b border-ink-200 py-14 text-center">
      <span className="text-eyebrow tracking-[0.24em] text-ink-600">今晚還沒有條目</span>
      <p className="mx-auto mt-3 mb-0 max-w-[260px] font-serif-tc text-prose leading-[1.7] font-bold text-ink-950">
        散場之後想說點什麼？按下方的「說一段」，開出今晚第一篇。
      </p>
    </div>
  );
}
