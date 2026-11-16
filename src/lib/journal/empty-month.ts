/**
 * 日誌空月份（UX-24，純函式）：過去月份不能寫「從今晚開始」。
 * - 過去：這個月沒有紀錄＋補記一筆（sheet 切到選日期時間，日期給人選）
 * - 本月：維持原文案（記第一筆）
 * - 未來：排一場的語氣（sheet 切到選日期時間＝排行程）
 * 稿紙格本身照舊可點（journal-calendar.tsx EmptyGrid），這裡只管下方文案與按鈕。
 */

export type MonthTense = "past" | "current" | "future";

export interface EmptyMonthCopy {
  /** 標題分兩行 */
  title: readonly [string, string];
  body: string;
  action: string;
}

export interface EmptyMonthPrefill {
  when: "custom";
  custom: string;
  /** 補記過去：主鈕／說明不講「排行程」 */
  intent?: "backfill";
}

/** month 與 current 都是 "YYYY-MM"，字串比較即時間先後 */
export function monthTense(month: string, current: string): MonthTense {
  if (month < current) return "past";
  return month > current ? "future" : "current";
}

const COPY: Record<MonthTense, EmptyMonthCopy> = {
  past: {
    title: ["這個月沒有紀錄。", "想起來的，還能補記。"],
    body: "點那天的日期格就能補上那天看過、聽過、逛過的；記得不清楚也沒關係，日期之後都能改。",
    action: "補記一筆",
  },
  current: {
    title: ["這個月的第一筆，", "從今晚開始。"],
    body: "看完、聽完、逛完，點那天的日期格就能記；點之後的日子，就是排進行程。三秒，之後想說再說。",
    action: "記第一筆",
  },
  future: {
    title: ["這個月還空著，", "先排一場吧。"],
    body: "想看的、想去的，點那天的日期格就排進行程，當天早上會提醒你。",
    action: "排一場",
  },
};

export function emptyMonthCopy(tense: MonthTense): EmptyMonthCopy {
  return COPY[tense];
}

export function emptyMonthPrefill(tense: MonthTense): EmptyMonthPrefill | undefined {
  if (tense === "past") return { when: "custom", custom: "", intent: "backfill" };
  if (tense === "future") return { when: "custom", custom: "" };
  return undefined;
}
