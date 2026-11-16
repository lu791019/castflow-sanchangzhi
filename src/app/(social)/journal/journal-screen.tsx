/**
 * 日誌（設計稿「日誌 A–D」）：刊頭＋我的分頁切換（日誌／專欄）＋月份刊頭＋月曆或清單。
 * 月份、檢視、展開的那天都在網址上（server 渲染、可直接連結）。
 */

import Link from "next/link";
import { ChevronIcon, InboxIcon } from "@/components/journal/icons";
import { emptyMonthCopy, emptyMonthPrefill, monthTense } from "@/lib/journal/empty-month";
import {
  adjacentMonth,
  buildCalendar,
  groupByDate,
  happenedEntries,
  monthStatLine,
  monthSubLine,
  monthTitle,
  pendingEntries,
  type JournalViewEntry,
} from "@/lib/journal/view";
import type { WorkLink } from "@/lib/links/types";
import { columnLabel } from "@/lib/me/column-name";
import { PenSeal } from "@/components/seal/pen-seal";
import { CalendarGrid, EmptyGrid } from "./journal-calendar";
import { FirstEntryButton } from "./journal-actions";
import { DayLogButton } from "./journal-day-log";
import { journalHref, type JournalQuery } from "./journal-href";
import { DayRow, ListRow, PendingRow, UpcomingRow } from "./journal-rows";
import { dayAnchorId, latestEntryId } from "./day-scroll";
import { ScrollToDay } from "./scroll-to-day";
import { MAX_MONTHS_AHEAD } from "./load-journal";

export interface JournalScreenProps {
  query: JournalQuery;
  currentMonth: string;
  entries: JournalViewEntry[];
  /** 接下來：排好還沒到的計畫（跨月，最多 5 筆） */
  upcoming: JournalViewEntry[];
  /** 接下來每列的次鈕（去哪買票／在哪看／官網），以 entry id 對應 */
  upcomingLinks?: Record<string, WorkLink>;
  penName: string;
  columnName: string | null;
  unreadCount: number;
  now: Date;
}

function Masthead({ unreadCount }: { unreadCount: number }) {
  return (
    <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
      <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
      <Link
        href="/notifications"
        aria-label={unreadCount ? `收件匣，${unreadCount} 則未讀` : "收件匣"}
        className="relative -mr-2.5 flex size-11 items-center justify-center text-ink-950"
      >
        <InboxIcon />
        {unreadCount ? (
          <span className="absolute top-[9px] right-[9px] block size-[7px] rounded-full bg-unread-dot shadow-[0_0_0_2px_var(--color-paper)]" />
        ) : null}
      </Link>
    </header>
  );
}

function ProfileTabs({ penName, columnName, unreadCount }: { penName: string; columnName: string | null; unreadCount: number }) {
  const label = columnLabel(columnName);
  return (
    <>
      <div className="mx-4 flex items-center gap-2.5 pt-3.5">
        <PenSeal penName={penName} size={40} />
        <span className="flex flex-col gap-px">
          <span className="font-serif-tc text-lede font-bold text-ink-950">{penName}</span>
          {label ? <span className="text-eyebrow text-ink-600">{label}</span> : null}
        </span>
        {/* 第 0 步（Q-69）：看完當下直接說一段 → 你語氣的 Threads */}
        <Link
          href="/watched"
          data-testid="watched-entry"
          className="ml-auto flex min-h-11 items-center rounded-full bg-ink-900 px-4 text-caption font-medium text-paper no-underline"
        >
          看完了
        </Link>
      </div>
      <nav aria-label="我的" className="mx-4 mt-2.5 flex gap-[26px] border-b border-ink-200">
        <Link
          href="/journal"
          aria-current="page"
          className="flex min-h-11 items-center font-serif-tc text-prose font-bold text-ink-950 no-underline shadow-[inset_0_-2px_0_var(--color-ember)]"
        >
          日誌
        </Link>
        <Link href="/me" className="flex min-h-11 items-center font-serif-tc text-prose text-ink-600 no-underline">
          專欄
        </Link>
        {/* 桌機沒有手機刊頭的收件匣鈕，改放在分頁列 */}
        <Link href="/notifications" className="relative hidden min-h-11 items-center font-serif-tc text-prose text-ink-600 no-underline lg:flex">
          收件匣
          {unreadCount ? <span aria-label={`${unreadCount} 則未讀`} className="p4-dot ml-1 block size-[6px] rounded-full bg-unread-dot" /> : null}
        </Link>
      </nav>
    </>
  );
}

function ViewToggle({ query }: { query: JournalQuery }) {
  const tab = (view: JournalQuery["view"], label: string) => {
    const on = query.view === view;
    return (
      <Link
        href={journalHref({ ...query, view, day: null })}
        scroll={false}
        role="radio"
        aria-checked={on}
        className={`flex min-h-11 min-w-11 items-center justify-center text-note no-underline ${on ? "font-bold text-ink-950" : "text-ink-600"}`}
      >
        <span className={`pb-[3px] ${on ? "shadow-[inset_0_-2px_0_var(--color-ember)]" : ""}`}>{label}</span>
      </Link>
    );
  };
  return (
    <div role="radiogroup" aria-label="檢視方式" className="-mr-[9px] flex">
      {tab("cal", "月曆")}
      {tab("list", "清單")}
    </div>
  );
}

function MonthHead({ query, currentMonth, entries }: Pick<JournalScreenProps, "query" | "currentMonth" | "entries">) {
  const { name, year } = monthTitle(query.month);
  const prev = adjacentMonth(query.month, -1);
  const next = adjacentMonth(query.month, 1);
  const canNext = next <= adjacentMonth(currentMonth, MAX_MONTHS_AHEAD);
  return (
    <section className="mx-4 mt-5">
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="m-0 font-serif-tc text-headline font-bold tracking-[0.08em] text-ink-950">{name}</h1>
          <span className="text-note text-ink-600 tabular-nums">{year}</span>
        </div>
        <div className="flex">
          <Link href={journalHref({ ...query, month: prev, day: null })} aria-label="上個月" className="flex size-11 items-center justify-center text-ink-700">
            <ChevronIcon dir="left" />
          </Link>
          {canNext ? (
            <Link href={journalHref({ ...query, month: next, day: null })} aria-label="下個月" className="-mr-3 flex size-11 items-center justify-center text-ink-700">
              <ChevronIcon dir="right" />
            </Link>
          ) : (
            <span aria-hidden="true" className="-mr-3 flex size-11 items-center justify-center text-ink-300">
              <ChevronIcon dir="right" />
            </span>
          )}
        </div>
      </div>
      <p className="mt-1.5 mb-0 font-serif-tc text-lede leading-[1.8] text-ink-800">{monthStatLine(happenedEntries(entries))}</p>
      <div className="mt-2 flex items-center justify-between border-t border-ink-950">
        <span className="text-eyebrow tracking-[0.08em] text-ink-600">{monthSubLine(happenedEntries(entries))}</span>
        <ViewToggle query={query} />
      </div>
    </section>
  );
}

/** 接下來（排行程）：放在月份刊頭上面，跨月；沒有計畫就不出現 */
function Upcoming({ entries, links = {} }: { entries: JournalViewEntry[]; links?: Record<string, WorkLink> }) {
  if (entries.length === 0) return null;
  return (
    <section aria-label="接下來" className="mx-4 mt-5">
      <SectionHead title="接下來" aside="當天早上會提醒你" />
      <div className="p4-stagger">
        {entries.map((entry, index) => (
          <UpcomingRow key={entry.id} entry={entry} link={links[entry.id] ?? null} tour={index === 0 ? "journal-upcoming" : undefined} />
        ))}
      </div>
    </section>
  );
}

function SectionHead({ title, aside, action }: { title: string; aside: string; action?: React.ReactNode }) {
  return (
    <div className={`flex justify-between border-b border-ink-950 pb-2 ${action ? "items-center" : "items-baseline"}`}>
      <h2 className="m-0 font-serif-tc text-section font-bold text-ink-950">{title}</h2>
      {action ? (
        <span className="flex items-center gap-2.5">
          <span className="text-eyebrow text-ink-600">{aside}</span>
          {action}
        </span>
      ) : (
        <span className="text-eyebrow text-ink-600">{aside}</span>
      )}
    </div>
  );
}

function CalendarView({ query, entries, now }: Pick<JournalScreenProps, "query" | "entries" | "now">) {
  const calendar = buildCalendar(query.month, entries, now);
  const month = Number(query.month.split("-")[1]);
  const day = query.day ? calendar.days.find((d) => d.dateKey === query.day && d.count > 0) : undefined;
  const dayEntries = day ? groupByDate(entries).find((group) => group.dateKey === day.dateKey)?.entries ?? [] : [];
  const pending = pendingEntries(entries);
  const latestId = latestEntryId(entries);
  // 手機：展開某天時取代「還沒說的」；桌機右側當日清單常駐 288，兩段都在
  return (
    <div className="lg:mx-4 lg:mt-1 lg:grid lg:grid-cols-[minmax(0,1fr)_288px] lg:items-start lg:gap-x-8">
      <CalendarGrid
        month={month}
        calendar={calendar}
        selectedDay={query.day}
        hrefFor={(dateKey) => journalHref({ ...query, day: dateKey })}
      />
      <div className="lg:-ml-4 lg:border-l lg:border-ink-200 lg:pl-4">
        {day ? (
          <section id={dayAnchorId(day.dateKey)} aria-label={`${day.dateKey} 的紀錄`} className="mx-4 mt-[22px] scroll-mt-4 lg:mx-0 lg:mt-2">
            <SectionHead
              title={`${query.day?.slice(5).replace("-", ".")}　${day.weekday}`}
              aside={`${dayEntries.length} 筆`}
              action={<DayLogButton dateKey={day.dateKey} todayKey={day.isToday ? day.dateKey : ""} />}
            />
            <div className="p4-stagger">
              {[...dayEntries].reverse().map((entry) => (
                <DayRow key={entry.id} entry={entry} latest={entry.id === latestId} />
              ))}
            </div>
          </section>
        ) : null}
        {pending.length > 0 ? (
          <section className={`mx-4 mt-7 lg:mx-0 ${day ? "hidden lg:block" : "lg:mt-2"}`}>
            <SectionHead title="還沒說的" aside="隨時都可以回頭說" />
            <div className="p4-stagger">
              {pending.map((entry) => (
                <PendingRow key={entry.id} entry={entry} latest={!day && entry.id === latestId} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <ScrollToDay day={day ? day.dateKey : null} />
    </div>
  );
}

function ListView({ query, entries }: Pick<JournalScreenProps, "query" | "entries">) {
  const { name } = monthTitle(query.month);
  const latestId = latestEntryId(entries);
  return (
    <section aria-label="清單" className="p4-stagger mx-4 mt-1">
      {groupByDate(entries).map((group) => (
        <div key={group.dateKey} className="pt-[18px]">
          <div className="flex items-baseline gap-2 border-b border-ink-950 pb-1.5">
            <span className="font-serif-tc text-prose font-bold text-ink-950 tabular-nums">{group.label}</span>
            <span className="text-eyebrow text-ink-600">{group.weekday}</span>
          </div>
          {group.entries.map((entry) => (
            <ListRow key={entry.id} entry={entry} latest={entry.id === latestId} />
          ))}
        </div>
      ))}
      <p className="mt-5 mb-0 text-center text-eyebrow tracking-[0.3em] text-ink-600">— {name}一日之前 —</p>
    </section>
  );
}

/** 空月份：過去「沒有紀錄＋補記」、本月「從今晚開始」、未來「排一場」（UX-24，empty-month.ts） */
function EmptyMonth({ query, currentMonth, now }: Pick<JournalScreenProps, "query" | "currentMonth" | "now">) {
  const tense = monthTense(query.month, currentMonth);
  const copy = emptyMonthCopy(tense);
  return (
    <section className="mx-4 mt-3 flex flex-col">
      <EmptyGrid month={Number(query.month.split("-")[1])} calendar={buildCalendar(query.month, [], now)} />
      <h2 className="mt-7 mb-0 font-serif-tc text-section leading-[1.6] font-bold text-ink-950">
        {copy.title[0]}
        <br />
        {copy.title[1]}
      </h2>
      <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">{copy.body}</p>
      <FirstEntryButton label={copy.action} prefill={emptyMonthPrefill(tense)} />
    </section>
  );
}

export function JournalScreen(props: JournalScreenProps) {
  const { query, entries, now } = props;
  return (
    <div className="pb-[116px]">
      <Masthead unreadCount={props.unreadCount} />
      <ProfileTabs penName={props.penName} columnName={props.columnName} unreadCount={props.unreadCount} />
      <Upcoming entries={props.upcoming} links={props.upcomingLinks} />
      <MonthHead query={query} currentMonth={props.currentMonth} entries={entries} />
      {entries.length === 0 ? (
        <EmptyMonth query={query} currentMonth={props.currentMonth} now={now} />
      ) : query.view === "list" ? (
        <ListView query={query} entries={entries} />
      ) : (
        <CalendarView query={query} entries={entries} now={now} />
      )}
    </div>
  );
}
