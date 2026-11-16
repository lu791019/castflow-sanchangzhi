/**
 * 功能開關（server 端讀，執行期生效）。
 * 社群（P3：句邊共鳴、回信與讀者來函、同場的人、索引／搜尋、作者專欄頁）：
 * CPO 10/11「先做後上」→ 預設關；部署時設 FEATURE_COMMUNITY=on 才開。
 * 關閉時：社群頁面與 API 回 404、入口不顯示；印章、印文、專欄名、記一筆場外與場刊本身照常。
 */

type Env = Readonly<Record<string, string | undefined>>;

export function communityEnabled(env: Env = process.env): boolean {
  return env.FEATURE_COMMUNITY === "on";
}

/**
 * Spotify 收聽紀錄提醒（Q-64 C1）：設定頁「連結 Spotify」與 /api/spotify/* 路由。
 * 要先套 migration 041（spotify_connections、notifications.url／dedupe_key）→ 預設關；部署時設 FEATURE_SPOTIFY_LISTEN=on 才開。
 */
export function spotifyListenEnabled(env: Env = process.env): boolean {
  return env.FEATURE_SPOTIFY_LISTEN === "on";
}
