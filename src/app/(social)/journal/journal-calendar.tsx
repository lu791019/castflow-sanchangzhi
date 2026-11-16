/** 日誌月曆（A/B）與空月份的稿紙格（D） */

import Link from "next/link";
import { HATCH_BG_DARK, MarkIcon } from "@/components/journal/icons";
import { DayCellButton } from "./journal-day-log";
import type { CalendarDay, CalendarMonth } from "@/lib/journal/view";
import type { WorkCategory } from "@/lib/journal/wording";

const WEEK_HEAD = ["日", "一", "二", "三", "四", "五", "六"];

function WeekHead() {
  return (
    <div className="grid h-7 grid-cols-7 items-center text-center text-eyebrow text-ink-600">
      {WEEK_HEAD.map((day) => (
        <span key={day}>{day}</span>
      ))}
    </div>
  );
}

function Mark({ category, cellBg }: { category: WorkCategory; cellBg: string }) {
  if (category === "screen") {
    return (
      <span
        className="-ml-1 block h-5 w-[13px] first:ml-0 md:ml-0.5 md:h-10 md:w-[22px] md:first:ml-0 xl:ml-1 xl:h-12 xl:w-8"
        style={{ background: HATCH_BG_DARK, boxShadow: `0 0 0 1.5px ${cellBg}` }}
      />
    );
  }
  return (
    <span
      className="-ml-0.5 flex size-4 items-center justify-center rounded-full text-ink-800 first:ml-0"
      style={{ background: cellBg }}
    >
      <MarkIcon category={category} />
    </span>
  );
}

function cellLabel(month: number, day: CalendarDay): string {
  const parts = [`${month} 月 ${day.day} 日，${day.weekday}`];
  if (day.isToday) parts.push("今天");
  parts.push(day.count ? `${day.count} 筆` : "沒有紀錄");
  if (day.hasArticle) parts.push("有文章");
  if (!day.count) parts.push(day.isFuture ? "排進行程" : "記一筆");
  return parts.join("，");
}

interface CalendarGridProps {
  month: number;
  calendar: CalendarMonth;
  selectedDay: string | null;
  hrefFor: (dateKey: string | null) => string;
}

export function CalendarGrid({ month, calendar, selectedDay, hrefFor }: CalendarGridProps) {
  const todayKey = calendar.days.find((day) => day.isToday)?.dateKey ?? "";
  return (
    <section aria-label={`${month} 月月曆`} className="mx-4 mt-1 lg:mx-0 lg:mt-0">
      <WeekHead />
      <div className="grid grid-cols-7 border-b border-ink-200 md:border-r">
        {Array.from({ length: calendar.leading }, (_, index) => (
          <span key={`lead-${index}`} aria-hidden="true" className="h-[60px] border-t border-ink-200 md:h-[112px] md:bg-paper-2 lg:h-[120px] xl:h-[136px]" />
        ))}
        {calendar.days.map((day) => {
          const selected = day.dateKey === selectedDay;
          const cellBg = selected ? "var(--color-paper-2)" : "var(--color-paper)";
          const ring = day.isToday
            ? "shadow-[inset_0_0_0_1px_var(--color-calendar-today)]"
            : selected
              ? "shadow-[inset_0_0_0_1px_var(--color-calendar-selected-border)]"
              : "";
          const numTone = day.isToday
            ? "font-bold text-ember-dark"
            : day.isFuture
              ? "text-ink-300"
              : selected
                ? "font-bold text-ink-950"
                : "text-ink-700";
          const body = (
            <>
              <span className={`text-caption leading-none tabular-nums md:font-serif-tc md:text-note ${numTone}`}>{day.day}</span>
              <span className="flex h-[22px] items-end pl-1 md:h-10 md:pl-0 xl:h-12">
                {day.marks.map((category, index) => (
                  <Mark key={index} category={category} cellBg={cellBg} />
                ))}
              </span>
              <span className={`block size-1 rounded-full bg-ember ${day.hasArticle ? "" : "opacity-0"}`} />
            </>
          );
          // 平板起月曆放大成真正的月曆版面：格高 112／120／136，記號換成小海報
          const className = `flex h-[60px] flex-col items-start justify-between border-t border-ink-200 pt-1.5 pr-0 pb-[5px] pl-[5px] no-underline transition-colors duration-150 md:h-[112px] md:border-l md:p-2 xl:p-2.5 lg:h-[120px] xl:h-[136px] ${ring}`;
          // 沒有紀錄的格（含未來）：點下去開記一筆並預填那天；有紀錄的格維持展開清單
          if (day.count === 0) {
            return (
              <DayCellButton
                tour={day.isToday ? "journal-today" : undefined}
                key={day.dateKey}
                dateKey={day.dateKey}
                todayKey={todayKey}
                label={cellLabel(month, day)}
                className={className}
                style={{ background: cellBg }}
              >
                {body}
              </DayCellButton>
            );
          }
          return (
            <Link
              key={day.dateKey}
              href={hrefFor(selected ? null : day.dateKey)}
              scroll={false}
              aria-label={cellLabel(month, day)}
              aria-pressed={selected}
              data-tour={day.isToday ? "journal-today" : undefined}
              className={className}
              style={{ background: cellBg }}
            >
              {body}
            </Link>
          );
        })}
      </div>
      <Legend />
    </section>
  );
}

function Legend() {
  return (
    <div aria-hidden="true" className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-eyebrow text-ink-600">
      <span className="flex items-center gap-1">
        <span className="block h-3 w-2" style={{ background: HATCH_BG_DARK }} />
        電影・影集
      </span>
      <span className="flex items-center gap-1">
        <MarkIcon category="podcast" size={12} />
        Podcast
      </span>
      <span className="flex items-center gap-1">
        <MarkIcon category="live" size={12} />
        演出
      </span>
      <span className="flex items-center gap-1">
        <MarkIcon category="exhibition" size={12} />
        展覽
      </span>
      <span className="flex items-center gap-1">
        <span className="block size-1 rounded-full bg-ember" />
        說成了文章
      </span>
    </div>
  );
}

/** D：空月份——稿紙格線，只標今天；日期格一樣能點，開記一筆並預填那天（未來格＝排進行程） */
export function EmptyGrid({ month, calendar }: { month: number; calendar: CalendarMonth }) {
  const total = Math.ceil((calendar.leading + calendar.days.length) / 7) * 7;
  const todayKey = calendar.days.find((day) => day.isToday)?.dateKey ?? "";
  const cellBase = "box-border h-12 border-r border-b border-ink-200 px-[5px] py-1 text-eyebrow tabular-nums";
  return (
    <div>
      <WeekHead />
      <div className="grid grid-cols-7 border-t border-l border-ink-200">
        {Array.from({ length: total }, (_, index) => {
          const day = calendar.days[index - calendar.leading];
          if (!day) return <span key={index} aria-hidden="true" className={cellBase} />;
          const tone = day.isToday
            ? "font-bold text-ember-dark shadow-[inset_0_0_0_1px_var(--color-calendar-today)]"
            : day.isFuture
              ? "text-ink-300"
              : "text-ink-700";
          return (
            <DayCellButton
              key={day.dateKey}
              dateKey={day.dateKey}
              todayKey={todayKey}
              label={cellLabel(month, day)}
              className={`${cellBase} flex items-start ${tone}`}
              style={{}}
            >
              {day.day}
            </DayCellButton>
          );
        })}
      </div>
    </div>
  );
}
