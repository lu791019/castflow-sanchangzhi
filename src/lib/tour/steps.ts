/**
 * 新手導覽步驟（implementation_plan「新手導覽與體驗流暢度」＋ Q-54 文案）。
 * 登入者：目標句 → 分岔 → 排行程路線（3a–3e）或記一筆路線（4a–4d）；訪客：三步（5b）。
 * 要點的步驟可以真的點被照亮的元素，或按「下一步」由 assist 幫忙（幫你點，或跳過要填資料的步驟）。
 */

import type { StepDef, StepId, TourFlow } from "./types";

export const TOAST_SELECTOR = '[data-tour="log-toast"]';
export const SHEET_SELECTOR = '[role="dialog"][aria-label="記一筆"]';
const WORK_PICKED_SELECTOR = '[data-tour="log-work"] [role="radio"][aria-checked="true"]';

export const STEPS: Readonly<Record<StepId, StepDef>> = {
  goal: {
    id: "goal",
    page: "before",
    target: null,
    mode: "info",
    title: "目標：記下你的第一場散場。",
    body: "跟著走一遍，不用一分鐘。",
    next: "fork",
  },
  fork: {
    id: "fork",
    page: "before",
    target: null,
    mode: "fork",
    title: "從哪裡開始？",
    body: "挑一個最像你現在的。",
    choices: [
      { label: "最近剛看完一部？", to: "log-center" },
      { label: "想去看點什麼？", to: "plan-pick" },
    ],
  },
  "plan-pick": {
    id: "plan-pick",
    page: "before",
    target: ["before-plan"],
    clickWithin: 'button[aria-label^="排進行程"]',
    mode: "action",
    assist: "click",
    title: "排進行程",
    body: "點「排進行程」，把想看的那一場排進日誌。",
    outcomes: [{ on: "click", to: "plan-submit" }],
  },
  "plan-submit": {
    id: "plan-submit",
    page: "before",
    target: ["log-submit"],
    inSheet: true,
    pin: "top",
    resumeAs: "plan-pick",
    mode: "action",
    // 挑時間是使用者的事：不替人送出，跳到最後的說明卡（「接下來」「排好了」都宣稱已排）
    assist: { skipTo: "plan-center", label: "先不排，下一步" },
    title: "挑個時間，送出",
    body: "選好日期時間，按「排進行程」。",
    outcomes: [
      { on: "appear", selector: TOAST_SELECTOR, to: "plan-journal" },
      // 第一次記下會先去通知權限引導，離開後回日誌：直接接日誌那一步
      { on: "page", page: "notify", to: "plan-upcoming" },
      { on: "page", page: "say", to: "log-say" },
    ],
  },
  "plan-journal": {
    id: "plan-journal",
    page: "before",
    target: ["nav-journal"],
    mode: "action",
    claimsSaved: true,
    assist: "click",
    title: "排好了",
    body: "點「日誌」看看。",
    side: "top",
    outcomes: [{ on: "click", to: "plan-upcoming" }],
  },
  "plan-upcoming": {
    id: "plan-upcoming",
    page: "journal",
    target: ["journal-upcoming"],
    mode: "info",
    claimsSaved: true,
    title: "接下來",
    body: "散場那刻會提醒你說一段。",
    next: "plan-center",
  },
  "plan-center": {
    id: "plan-center",
    page: "journal",
    target: ["center-button"],
    mode: "info",
    title: "中央圓鈕",
    body: "按住說一段，或打字寫下來；不想寫也能只記。",
    wide: { title: "記一筆", body: "隨時點右上角的「記一筆」；想說就按旁邊的「說一段」，不想寫也能只記。" },
    side: "top",
    next: null,
  },
  "log-center": {
    id: "log-center",
    page: "before",
    target: ["center-button"],
    // 窄版是包著圓鈕的容器（裡面還有提示泡泡的「知道了」）；寬版刊頭的按鈕本身就是目標
    clickWithin: 'button[aria-label="記一筆"], button[data-tour="center-button"]',
    mode: "action",
    assist: "click",
    title: "記一筆",
    body: "點一下中央圓鈕。",
    wide: { body: "點一下右上角的「記一筆」。" },
    side: "top",
    outcomes: [{ on: "click", to: "log-work" }],
  },
  "log-work": {
    id: "log-work",
    page: "before",
    target: ["log-work"],
    inSheet: true,
    pin: "bottom",
    resumeAs: "log-center",
    mode: "action",
    // 選作品、記下都是使用者的事：記一筆路線後面的卡都宣稱已記下，跳到同樣不宣稱的圓鈕說明卡
    assist: { skipTo: "plan-center", label: "先不記，下一步" },
    title: "選作品",
    body: "點你剛看完的那一部；找不到就按搜尋。",
    outcomes: [{ on: "appear", selector: WORK_PICKED_SELECTOR, to: "log-actions" }],
  },
  "log-actions": {
    id: "log-actions",
    page: "before",
    target: ["log-actions"],
    inSheet: true,
    pin: "top",
    resumeAs: "log-center",
    mode: "action",
    assist: { skipTo: "plan-center", label: "先不記，下一步" },
    title: "說一段，或先記下",
    body: "想寫就寫，說的或打的都行；不想寫，直接記下就好。",
    outcomes: [
      { on: "appear", selector: TOAST_SELECTOR, to: "log-journal" },
      { on: "page", page: "notify", to: "log-latest" },
      { on: "page", page: "say", to: "log-say" },
    ],
  },
  "log-journal": {
    id: "log-journal",
    page: "before",
    target: ["nav-journal"],
    mode: "action",
    claimsSaved: true,
    assist: "click",
    title: "記下了",
    body: "點「日誌」看看。",
    side: "top",
    outcomes: [{ on: "click", to: "log-latest" }],
  },
  "log-latest": {
    id: "log-latest",
    page: "journal",
    target: ["journal-latest-entry", "journal-today"],
    mode: "info",
    claimsSaved: true,
    title: "日誌裡有這一筆",
    body: "之後想說，隨時回來說。",
    next: null,
  },
  "log-say": {
    id: "log-say",
    page: "say",
    target: null,
    waitGone: SHEET_SELECTOR,
    mode: "info",
    title: "說的或打的都行",
    body: "說完或寫完，就整理成一篇。",
    next: null,
  },
  "guest-masthead": {
    id: "guest-masthead",
    page: "feed",
    target: ["feed-masthead"],
    mode: "info",
    title: "看完一部，說一段，就成了一篇",
    body: "這裡是大家散場之後說的話。",
    next: "guest-first",
  },
  "guest-first": {
    id: "guest-first",
    page: "feed",
    target: ["feed-first"],
    mode: "action",
    assist: "click",
    title: "讀一篇",
    body: "點第一篇看看。",
    outcomes: [{ on: "click", to: "guest-cta" }],
  },
  "guest-cta": {
    id: "guest-cta",
    page: "article",
    target: ["article-cta"],
    mode: "info",
    title: "開始寫",
    body: "登入就能記你的第一場。",
    side: "top",
    next: null,
  },
};

/** 路線（算「步驟 n／N」與進度點用） */
export const ROUTES = {
  plan: ["goal", "fork", "plan-pick", "plan-submit", "plan-journal", "plan-upcoming", "plan-center"],
  log: ["goal", "fork", "log-center", "log-work", "log-actions", "log-journal", "log-latest"],
  logSay: ["goal", "fork", "log-center", "log-work", "log-actions", "log-say"],
  guest: ["guest-masthead", "guest-first", "guest-cta"],
} as const satisfies Record<string, readonly StepId[]>;

export const FIRST_STEP: Readonly<Record<TourFlow, StepId>> = { member: "goal", guest: "guest-masthead" };

/** 第一次自動播放的頁面：登入者在散場之前、訪客在目錄 */
export const AUTO_START_PAGE = { member: "before", guest: "feed" } as const;

export function isStepId(value: unknown): value is StepId {
  return typeof value === "string" && Object.hasOwn(STEPS, value);
}

export function flowOf(step: StepId): TourFlow {
  return step.startsWith("guest-") ? "guest" : "member";
}

/** 選擇器：只靠 data-tour 屬性，不靠文字或順序 */
export function tourSelector(name: string): string {
  return `[data-tour="${name}"]`;
}

/** 寬螢幕斷點（與 Tailwind lg 相同）：刊頭取代底部導覽與中央圓鈕 */
export const WIDE_QUERY = "(min-width: 1024px)";

/** 卡片文案：寬螢幕有 wide 就用 wide 的（逐欄替換），否則用預設 */
export function stepText(step: Pick<StepDef, "title" | "body" | "wide">, wide: boolean): { title: string; body: string } {
  if (!wide || !step.wide) return { title: step.title, body: step.body };
  return { title: step.wide.title ?? step.title, body: step.wide.body ?? step.body };
}
