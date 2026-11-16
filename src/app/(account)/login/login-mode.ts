/**
 * 登入頁的兩種語氣（UX-12，純函式）：
 * - start：新人從記一筆／說一段／我的被請來登入，或從封面點「用 email 開始」→「用 email 開一個專欄」
 * - recover：封面「已經有專欄了？」、其他頁、連結失效 →「找回專欄」
 * 兩者送出的都是同一個 magic link；有專欄的人用同一個 email 也會回到原本那個。
 */

export type LoginMode = "start" | "recover";

/** 封面「用 email 開始」帶的 step */
export const LOGIN_START_STEP = "start";

const START_SOURCES = /^\/(?:journal|say|me)(?:[/?#]|$)/;

export interface LoginModeInput {
  /** 已經過 safeNextPath 的站內路徑 */
  next: string;
  step?: string;
  linkFailed?: boolean;
}

export function loginMode({ next, step, linkFailed = false }: LoginModeInput): LoginMode {
  if (linkFailed || step === "mail") return "recover";
  if (step === LOGIN_START_STEP) return "start";
  return START_SOURCES.test(next) ? "start" : "recover";
}

export interface LoginCopy {
  /** 頁頂置中標題 */
  title: string;
  eyebrow: string;
  /** 大標分兩行 */
  heading: readonly [string, string];
  note: string;
}

export const LOGIN_COPY: Record<LoginMode, LoginCopy> = {
  start: {
    title: "開一個專欄",
    eyebrow: "第一次來",
    heading: ["用 email 開一個專欄，", "下次在任何裝置都找得到它。"],
    note: "不用密碼。點信裡的連結，專欄就開好了；已經有專欄的，用同一個 email 會回到原本那個。",
  },
  recover: {
    title: "找回專欄",
    eyebrow: "在任何裝置",
    heading: ["用 email 收一個連結，", "下次在任何裝置都找得到你的專欄。"],
    note: "不用密碼。點信裡的連結，就回到你的專欄。",
  },
};
