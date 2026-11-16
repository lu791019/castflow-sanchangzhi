import Link from "next/link";
import { EmptyFeed } from "@/components/feed/feed-entries";
import { editionLabel, feedIssueNo, FEED_TABS, type FeedEntry, type FeedTab } from "@/lib/feed/entries";
import { feedIndex } from "@/lib/feed/index-column";
import { logicalDayParts } from "@/lib/journal/time";
import { dateStamp, logicalWeekday } from "@/lib/journal/wording";
import { SHELF_COLUMNS, WIDE_TIERS } from "@/lib/wide/layout";
import { formatIssueNo } from "@/lib/works/format";
import { WIDE_CONTAINER } from "./container";
import { WideContents, WideTonightBand } from "./wide-contents";
import { WideCoverStory } from "./wide-cover-story";
import { WideShelf } from "./wide-shelf";

/**
 * 寬螢幕目錄（Q-60 雛型 Main）：大刊名＋分類列 → 封面故事 → 本期目次 → 今晚的一句深色帶 → 這週被說起的海報架。
 * 只在 ≥1024 顯示；手機、平板的目錄流照舊（page.tsx 那份在 lg 藏起來）。
 */

interface WideCatalogProps {
  entries: FeedEntry[];
  tab: FeedTab;
  tonight: { quote: string; fromTitle: string } | null;
  now: Date;
  community: boolean;
}

const SHELF_MAX = Math.max(...WIDE_TIERS.map((tier) => SHELF_COLUMNS[tier]));

function WideMasthead({ count, tab, now }: { count: number; tab: FeedTab; now: Date }) {
  return (
    <header className={`${WIDE_CONTAINER} pt-9`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink-300 pb-2.5 text-note tracking-[0.24em] text-ink-600 tabular-nums">
        <span>{formatIssueNo(feedIssueNo(now))}</span>
        <span>散場之後，大家說了什麼</span>
        <span>
          {logicalDayParts(now).year} 年 {dateStamp(now)}　{logicalWeekday(now)}　{editionLabel(now)}
        </span>
      </div>
      <h1
        data-tour="feed-masthead"
        className="m-0 pt-[18px] pb-2.5 text-center font-serif-tc text-[clamp(88px,15vw,216px)] leading-none font-black tracking-[0.08em] text-ink-950"
      >
        散場誌
      </h1>
      {/* 分類照真實類別（Q-61）：全部／影劇／Podcast／音樂／演出／展覽／隨筆 */}
      <nav
        aria-label="分類"
        className="flex flex-wrap items-center justify-center gap-x-7 border-t-[3px] border-b border-double border-ink-950 text-note tracking-[0.18em]"
      >
        <span className="text-ink-700 tabular-nums">本期 {count} 篇</span>
        <span aria-hidden="true" className="text-ink-300">
          ｜
        </span>
        {FEED_TABS.map(({ tab: itemTab, label, href }) => (
          <Link
            key={itemTab}
            href={href}
            aria-current={tab === itemTab ? "page" : undefined}
            className={`flex min-h-11 items-center no-underline ${tab === itemTab ? "font-bold text-ember-dark" : "text-ink-900"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function WideCatalog({ entries, tab, tonight, now, community }: WideCatalogProps) {
  const lead = entries[0] ?? null;
  const { works } = feedIndex(entries, SHELF_MAX);
  return (
    <div className="hidden pb-16 lg:block">
      <WideMasthead count={entries.length} tab={tab} now={now} />
      {lead ? (
        <>
          {/* 導覽「讀一篇」的目標（窄版在 page.tsx 的 feed-first；寬版只看得到這一份） */}
          <div data-tour="feed-first">
            <WideCoverStory entry={lead} />
          </div>
          <WideContents entries={entries} />
          {tonight ? <WideTonightBand quote={tonight.quote} fromTitle={tonight.fromTitle} /> : null}
          <WideShelf works={works} indexHref={community ? "/catalog" : "/works"} />
          <p className={`${WIDE_CONTAINER} mt-10 mb-0 text-center text-note tracking-[0.4em] text-ink-600`}>— 今晚就到這裡 —</p>
        </>
      ) : (
        <div className={WIDE_CONTAINER}>
          <EmptyFeed />
        </div>
      )}
    </div>
  );
}
