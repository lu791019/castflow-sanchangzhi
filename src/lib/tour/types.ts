/** 新手導覽的型別（Dex 10/14 拍板 Q-49～Q-54；步驟見 steps.ts） */

export type TourFlow = "member" | "guest";

/** 導覽會出現的頁面（pageOf 由網址判斷）；notify＝第一次記下後的通知權限引導（只當完成條件，不出卡） */
export type TourPage = "before" | "journal" | "feed" | "article" | "say" | "notify";

export type StepId =
  | "goal"
  | "fork"
  | "plan-pick"
  | "plan-submit"
  | "plan-journal"
  | "plan-upcoming"
  | "plan-center"
  | "log-center"
  | "log-work"
  | "log-actions"
  | "log-journal"
  | "log-latest"
  | "log-say"
  | "guest-masthead"
  | "guest-first"
  | "guest-cta";

/** 動作步驟怎樣才算完成：真的點了被照亮的元素／某個元素出現／換到某頁 */
export type Outcome =
  | { on: "click"; to: StepId }
  | { on: "appear"; selector: string; to: StepId }
  | { on: "page"; page: TourPage; to: StepId };

/**
 * 動作步驟的「下一步」（Dex 10/17：幫你點）：
 * click＝替使用者點被照亮的元素（有 clickWithin 就點那個），照 outcomes 往下走；
 * skipTo＝要使用者填資料的步驟，不替人寫入，關掉記一筆 sheet、跳到不宣稱已寫入的卡（不同頁就換過去）
 */
/** click＝幫你點被照亮的元素；skipTo＝不替使用者寫資料、跳到該步，label 是主鈕文字（例：「先不排，下一步」） */
export type Assist = "click" | { skipTo: StepId; label: string };

export interface ForkChoice {
  label: string;
  to: StepId;
}

interface StepBase {
  id: StepId;
  page: TourPage;
  /** data-tour 名稱，依序找第一個看得見的；null＝不指元素，卡片置中 */
  target: readonly string[] | null;
  title: string;
  body: string;
  /** 寬螢幕（≥1024，沒有中央圓鈕、改用刊頭「記一筆」）時替換的文案 */
  wide?: { title?: string; body?: string };
  side?: "top" | "bottom";
  /** 記一筆 sheet 裡的步驟：整張 sheet 可操作 */
  inSheet?: boolean;
  /** 卡片釘在畫面頂端／底端（sheet 佔滿畫面時，不擋要操作的那段） */
  pin?: "top" | "bottom";
  /** 重新整理或回來時 sheet 已關：退回打開 sheet 的那一步 */
  resumeAs?: StepId;
  /** 等這個元素消失再出卡（換頁時舊畫面還在，例如記一筆 sheet） */
  waitGone?: string;
  /** 文案宣稱資料已寫入（排好了／記下了／日誌裡有這一筆）：「下一步」跳過填資料時不准落在這 */
  claimsSaved?: true;
}

/** 說明步驟：「下一步」；next 為 null＝最後一步，主鈕「完成」 */
export interface InfoStep extends StepBase {
  mode: "info";
  next: StepId | null;
}

/** 動作步驟（真的點）：主鈕「下一步」照 assist 幫忙，略過仍在 */
export interface ActionStep extends StepBase {
  mode: "action";
  assist: Assist;
  /** 只認被照亮元素裡符合這個選擇器的點擊（預設整個元素） */
  clickWithin?: string;
  outcomes: readonly Outcome[];
}

/** 分岔卡：兩個選項，選了就走那條路線 */
export interface ForkStep extends StepBase {
  mode: "fork";
  choices: readonly ForkChoice[];
}

export type StepDef = InfoStep | ActionStep | ForkStep;

/** localStorage 存的狀態（每位登入者一份、訪客每個瀏覽器一份） */
export type TourState =
  | { status: "active"; step: StepId; explicit: boolean }
  | { status: "done" };
