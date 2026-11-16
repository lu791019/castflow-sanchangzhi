/**
 * 本機 E2E 專用的執行期開關（正式環境不吃）。
 * - 外部服務網址覆寫（TMDB／文化部／Apple 榜／iTunes／文章匯入 fixture）：next dev（非 production）一律可覆寫；
 *   E2E 先打包再 `next start`（NODE_ENV=production）時要明確設 E2E_EXTERNAL_MOCKS=on 才可覆寫。
 *   Cloud Run（有 K_SERVICE）不論設什麼都不吃，避免正式站被指到假 server。
 * - 不寄登入信：E2E 對雲端 Supabase 跑時設 E2E_BLOCK_AUTH_EMAIL=on，「寄連結給我」直接回錯、不呼叫 signInWithOtp
 *   （雲端走 Resend 真寄，寄到 example.com 會退信、傷寄件信譽）。Cloud Run（有 K_SERVICE）一律不擋，正式站誤設也照常能登入。
 */

type Env = Readonly<Record<string, string | undefined>>;

export function externalOverridesAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.E2E_EXTERNAL_MOCKS === "on" && !env.K_SERVICE;
}

export function authEmailBlocked(env: Env = process.env): boolean {
  return env.E2E_BLOCK_AUTH_EMAIL === "on" && !env.K_SERVICE;
}
