/** 記一筆 sheet 的主鈕與說明文字（純函式）：跟著狀態走，排行程不再說「明天中午」（UX-11） */

import { timingCopy, type TimingCopy } from "./remind";
import type { ReminderTiming } from "./types";

export interface SubmitLabelState {
  isLive: boolean;
  /** 已選作品（或場外已寫名稱） */
  hasSubject: boolean;
  hasPlace: boolean;
  /** 時間已決定（選日期時間模式下已選好） */
  hasTime: boolean;
  /** 選的是未來時間 */
  planned: boolean;
  /** 從「排進行程」打開 */
  planMode: boolean;
}

const PLAN_COPY: TimingCopy = { hint: "當天早上會提醒你。", toast: "排好了，當天早上會提醒你。" };
/** 訪客：送出會先請他登入（UX-03 草稿會留著），不承諾提醒（UX-28） */
const GUEST_COPY: TimingCopy = { hint: "按下去會先請你登入，剛剛填的會留著。", toast: "" };

export function logSubmitLabel(state: SubmitLabelState): string {
  if (state.planMode && !state.hasTime) return "選一個日期時間";
  if (state.isLive) return state.hasSubject ? (state.planned ? "排進行程" : "記下了") : "寫下演出名或展覽名";
  if (!state.hasSubject || !state.hasPlace) return "選作品與在哪裡";
  return state.planned ? "排進行程" : "記下了";
}

export function logSheetCopy(timing: ReminderTiming, planned: boolean, planMode = false, guest = false): TimingCopy {
  if (guest) return GUEST_COPY;
  return planned || planMode ? PLAN_COPY : timingCopy(timing);
}
