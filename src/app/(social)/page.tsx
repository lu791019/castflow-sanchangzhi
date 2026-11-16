import type { Metadata } from "next";
import Link from "next/link";
import {
  editionLabel,
  feedIssueNo,
  FEED_TABS,
  filterFeedEntries,
  formatMastheadDate,
  parseFeedTab,
  pickTonightQuote,
  type FeedEntry,
} from "@/lib/feed/entries";
import { loadFeedEntries } from "@/lib/feed/load-entries";
import { EmptyFeed, FocusEntry, LeadEntry, ListEntry, TonightQuote } from "@/components/feed/feed-entries";
import { FeedIndexColumn } from "@/components/feed/feed-index";
import { PullToRefresh } from "@/components/motion/pull-to-refresh";
import { feedIndex } from "@/lib/feed/index-column";
import { MastheadSwitch } from "@/components/catalog/masthead-switch";
import { redirect } from "next/navigation";
import { BEFORE_PATH } from "@/components/app-shell/nav-routes";
import { getCurrentUserId } from "@/lib/auth/session";
import { communityEnabled } from "@/lib/features";
import { TourGuestInfo } from "@/components/tour/tour-mount";
import { WideCatalog } from "@/components/wide/wide-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "今晚的目錄｜散場誌",
  description: "散場之後，大家說了什麼",
};

/** 插頁位置：第 3 條之後（不足 3 條時放在最後） */
const QUOTE_AFTER_INDEX = 2;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  // 登入者打開裸 `/` → 散場之前（首屏，10/13 grill Q-34）；帶 tab 參數＝要看目錄，匿名永遠是目錄
  if (rawTab === undefined && (await getCurrentUserId())) redirect(BEFORE_PATH);
  const tab = parseFeedTab(rawTab);
  const entries = filterFeedEntries(await loadFeedEntries({ tab }), tab);
  const tonight = pickTonightQuote(entries);
  const now = new Date();
  const quoteAfter = Math.min(QUOTE_AFTER_INDEX, entries.length - 1);

  const lead = entries[0] ?? null;
  const index = feedIndex(entries);
  const community = communityEnabled();

  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950 md:hidden">
          散場誌
        </span>
        <span className="hidden text-eyebrow tracking-[0.14em] text-ink-600 md:inline">
          散場之後・No.{feedIssueNo(now)}
        </span>
        <span className="flex items-center gap-2">
          {/* 社群關閉時沒有索引：手機刊頭右上照舊放日期 */}
          <span className={`text-eyebrow tracking-[0.14em] text-ink-600 tabular-nums ${community ? "hidden md:inline" : ""}`}>
            {formatMastheadDate(now)} · {editionLabel(now)}
          </span>
          {community ? <MastheadSwitch current="feed" className="md:hidden" /> : null}
          <TourGuestInfo />
        </span>
      </header>

      {/* 寬螢幕（≥1024）改用雜誌版（Q-60）；這份手機／平板目錄在 lg 藏起來 */}
      <div className="px-4 pb-[120px] lg:hidden">
        <section className="pt-6 md:flex md:items-end md:justify-between md:gap-6 lg:pt-10">
          <div>
            <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">
              今晚的目錄
            </span>
            <h1 data-tour="feed-masthead" className="mt-2.5 mb-0 font-serif-tc text-headline leading-[1.38] font-bold text-ink-950">
              散場之後，
              <br className="md:hidden" />
              大家說了什麼
            </h1>
            <p className="mt-2.5 mb-0 text-caption tracking-[0.06em] text-ink-600 md:hidden">
              No.{feedIssueNo(now)} · 依發表時間排列
            </p>
          </div>
          <p className="mb-1 hidden text-caption tracking-[0.06em] text-ink-600 tabular-nums md:block">
            No.{feedIssueNo(now)} · {editionLabel(now)} · 共 {entries.length} 篇
          </p>
        </section>

        {/* 依作品類別分（Q-61）：七個分頁手機放不下就橫捲，不換行 */}
        <nav
          aria-label="分類"
          className="mt-5 flex gap-[18px] overflow-x-auto border-b border-ink-200 [scrollbar-width:none] md:gap-[22px] md:border-ink-950"
        >
          {FEED_TABS.map(({ tab: itemTab, label, href }) => (
            <Link
              key={itemTab}
              href={href}
              aria-current={tab === itemTab ? "page" : undefined}
              className={`hit-44 flex min-h-11 flex-none items-center text-note no-underline ${
                tab === itemTab
                  ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]"
                  : "text-ink-600"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <PullToRefresh>
          {entries.length === 0 ? <EmptyFeed /> : null}

          {/* 手機：單欄目錄流；768 焦點橫卡＋目錄 5／索引 3；1024 焦點＋雙欄目錄 8／索引 4；1280 焦點 5・目錄 4・索引 3 */}
          <div className="md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] md:gap-x-6 md:pt-7 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] xl:grid-cols-[448px_352px_256px] xl:gap-x-8">
            {lead ? (
              <>
                <div data-tour="feed-first" className="md:hidden">
                  <LeadEntry entry={lead} />
                </div>
                <div data-tour="feed-first" className="hidden md:col-span-2 md:block lg:col-span-1 lg:row-start-1 xl:col-start-1">
                  <FocusEntry entry={lead} />
                </div>
              </>
            ) : null}

            <div className="p4-stagger md:col-start-1 md:row-start-2 lg:grid lg:grid-cols-2 lg:content-start lg:gap-x-6 xl:col-start-2 xl:row-start-1 xl:-mx-4 xl:block xl:border-x xl:border-ink-200 xl:px-4">
              {entries.map((entry, entryIndex) =>
                entryIndex === 0 ? (
                  tonight && quoteAfter === 0 ? (
                    <TonightQuote key="tonight" quote={tonight.quote} fromTitle={tonight.fromTitle} />
                  ) : null
                ) : (
                  <FeedListItem
                    key={entry.id}
                    entry={entry}
                    index={entryIndex}
                    quote={tonight && entryIndex === quoteAfter ? tonight : null}
                  />
                ),
              )}
            </div>

            {entries.length > 0 ? (
              <div className="hidden md:col-start-2 md:row-start-2 md:-ml-3 md:block md:border-l md:border-ink-200 md:pl-3 lg:row-span-2 lg:row-start-1 xl:col-start-3 xl:row-start-1 xl:ml-0 xl:border-l-0 xl:pl-0">
                <FeedIndexColumn columns={index.columns} works={index.works} />
              </div>
            ) : null}
          </div>

          {entries.length > 0 ? (
            <p className="mt-7 mb-0 text-center text-eyebrow tracking-[0.3em] text-ink-600">
              {entries.length > 5 ? "— 繼續往下讀 —" : "— 今晚就到這裡 —"}
            </p>
          ) : null}
        </PullToRefresh>
      </div>
      <WideCatalog entries={entries} tab={tab} tonight={tonight} now={now} community={community} />
    </>
  );
}

/** 目錄流的一條；「今晚的一句」插在第 3 條之後（跨滿目錄欄） */
function FeedListItem({
  entry,
  index,
  quote,
}: {
  entry: FeedEntry;
  index: number;
  quote: { quote: string; fromTitle: string } | null;
}) {
  return (
    <>
      <ListEntry entry={entry} index={index} />
      {quote ? <TonightQuote quote={quote.quote} fromTitle={quote.fromTitle} /> : null}
    </>
  );
}
