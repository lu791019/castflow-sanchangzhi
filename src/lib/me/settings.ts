/** 我的 › 設定（設計稿 P2 設定 A–D）：提醒選項、提醒舉例、公開範圍說明、通知狀態等純邏輯 */

import { computeRemindAt } from "@/lib/journal/remind";
import type { ReminderTiming } from "@/lib/journal/types";
import { DAY_MS, pad2, taipeiDateKey, taipeiParts } from "@/lib/journal/time";
import type { Visibility } from "@/lib/proof/publish";

export interface ReminderOption {
  value: ReminderTiming;
  title: string;
  note: string;
  tag: string;
}

/** half_day：+12 小時，落在 23:00–9:00 延到早上 9 點（computeRemindAt） */
export const REMINDER_OPTIONS: readonly ReminderOption[] = [
  { value: "next_noon", title: "隔天中午", note: "看完後的隔天 12:00，像午休時想起來", tag: "預設" },
  { value: "half_day", title: "半天後", note: "記下後 12 小時，深夜就等到早上 9 點", tag: "" },
  { value: "off", title: "不提醒", note: "只記在日誌裡；想說的時候自己回來", tag: "" },
];

export function reminderTitle(timing: ReminderTiming): string {
  return REMINDER_OPTIONS.find((option) => option.value === timing)?.title ?? "隔天中午";
}

/** 相對今天的日子 + 時刻：「今晚 22:30」「今天 09:00」「明天 12:00」「10.12 09:00」 */
export function dayClockLabel(target: Date, now: Date): string {
  const parts = taipeiParts(target);
  const clock = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  if (taipeiDateKey(target) === taipeiDateKey(now)) return `${parts.hour >= 18 ? "今晚" : "今天"} ${clock}`;
  if (taipeiDateKey(target) === taipeiDateKey(new Date(now.getTime() + DAY_MS))) return `明天 ${clock}`;
  return `${pad2(parts.month)}.${pad2(parts.day)} ${clock}`;
}

export interface ReminderExample {
  fromLabel: string;
  fromTime: string;
  toLabel: string;
  toTime: string;
  /** 不提醒時右側用一般墨色 */
  muted: boolean;
}

/** sheet 底部舉例：如果現在記下一筆，什麼時候會問你（用真的提醒規則算） */
export function reminderExample(timing: ReminderTiming, now: Date): ReminderExample {
  const remindAt = computeRemindAt(now, timing);
  const from = { fromLabel: "如果現在記下一筆", fromTime: dayClockLabel(now, now) };
  if (!remindAt) return { ...from, toLabel: "留在日誌裡", toTime: "不會問你", muted: true };
  return { ...from, toLabel: "問你想不想說", toTime: dayClockLabel(remindAt, now), muted: false };
}

export const SCOPE_HELP: Record<Visibility, string> = {
  public: "會出現在首頁目錄與作品特輯，陌生人也讀得到。",
  unlisted: "不上目錄；拿到連結的人才讀得到。",
  private: "只有你看得到，像一本日記。",
};

export type NotifyState = "granted" | "denied" | "default" | "unsupported";

/** 通知列副標 */
export function notifyStatusLine(state: NotifyState): string {
  switch (state) {
    case "granted":
      return "已開啟";
    case "denied":
      return "被瀏覽器擋下了・提醒會先放在收件匣";
    case "unsupported":
      return "這個瀏覽器收不到通知・提醒會先放在收件匣";
    default:
      return "尚未開啟・提醒會先放在收件匣";
  }
}

/** iPhone / iPad 且不是從主畫面開（standalone）→ 顯示「先放到主畫面」提示 */
export function needsAddToHome(userAgent: string, standalone: boolean, maxTouchPoints = 0): boolean {
  const iPhoneLike = /iPhone|iPad|iPod/.test(userAgent);
  const iPadDesktopMode = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  return (iPhoneLike || iPadDesktopMode) && !standalone;
}

/** 我的節目入口右側：「3 個節目」「還沒有」 */
export function showsCountLabel(count: number): string {
  return count > 0 ? `${count} 個節目` : "還沒有";
}
