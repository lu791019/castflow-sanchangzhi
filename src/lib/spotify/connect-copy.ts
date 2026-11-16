/** 「連結 Spotify」的結果與設定頁文案（client 也用：不能 import node:crypto） */

export const SPOTIFY_SETTINGS_PATH = "/me/settings";

export const CONNECT_RESULTS = ["connected", "denied", "not_allowed", "invalid_state", "unavailable", "error"] as const;
export type ConnectResult = (typeof CONNECT_RESULTS)[number];

export function isConnectResult(value: unknown): value is ConnectResult {
  return CONNECT_RESULTS.some((result) => result === value);
}

/** 設定頁顯示的文案（callback 帶回來的結果） */
export const CONNECT_MESSAGES: Record<ConnectResult, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "連好了。聽完一張專輯，會問你要不要記一筆。" },
  denied: { tone: "warn", text: "你在 Spotify 按了取消，沒有連結。" },
  not_allowed: { tone: "warn", text: "目前是測試階段，名額有限，這個 Spotify 帳號還不在名單裡。" },
  invalid_state: { tone: "warn", text: "連結逾時或從別的分頁回來，請再按一次「連結 Spotify」。" },
  unavailable: { tone: "warn", text: "Spotify 連結暫時不能用，我們已經收到通知。" },
  error: { tone: "warn", text: "Spotify 那邊出了點問題，沒有連結成功，稍後再試。" },
};

export function settingsUrl(result: ConnectResult): string {
  return `${SPOTIFY_SETTINGS_PATH}?spotify=${result}#spotify`;
}
