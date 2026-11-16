"use client";

/** 日誌月曆的記一筆入口：沒有紀錄的日期格、展開清單標頭的「＋ 記一筆」，都預填那一天 */

import { HIT_Y4 } from "@/components/journal/hit-area";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { dayPrefill } from "@/lib/journal/day-prefill";

interface DayTarget {
  dateKey: string;
  /** 今天的日期鍵（不在這個月就給空字串） */
  todayKey: string;
}

function useOpenForDay({ dateKey, todayKey }: DayTarget): () => void {
  const { openLogSheet } = useLogSheet();
  return () => {
    const prefill = dayPrefill(dateKey, todayKey);
    openLogSheet(prefill ? { prefill } : undefined);
  };
}

interface DayCellButtonProps extends DayTarget {
  label: string;
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
  /** 導覽用 data-tour（今天那格） */
  tour?: string;
}

/** 沒有紀錄的格：點下去直接開記一筆（未來格送出就是排進行程） */
export function DayCellButton({ dateKey, todayKey, label, className, style, children, tour }: DayCellButtonProps) {
  const open = useOpenForDay({ dateKey, todayKey });
  return (
    <button type="button" onClick={open} aria-label={label} data-tour={tour} className={`${className} text-left`} style={style}>
      {children}
    </button>
  );
}

/** 展開某天的清單標頭：「＋ 記一筆」 */
export function DayLogButton({ dateKey, todayKey }: DayTarget) {
  const open = useOpenForDay({ dateKey, todayKey });
  return (
    <button
      type="button"
      onClick={open}
      className={`${HIT_Y4} flex min-h-9 items-center rounded-control border border-ink-950 px-3 text-caption font-bold text-ink-950`}
    >
      ＋ 記一筆
    </button>
  );
}
