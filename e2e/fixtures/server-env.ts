/**
 * E2E 伺服器（e2e/server.ts：next build＋standalone server.js）要帶的 env；playwright.config.ts 與 e2e/server.ts 共用。
 * 呼叫前要先用 @next/env 以 dev 優先序載入（.env.development.local 指雲端或本地 Supabase）：打包後的伺服器不會讀 .env.development.local。
 */

import path from "node:path";
import { assertAllowedSupabaseUrl, isRemoteE2E } from "./env";
import { mockRouterEnv } from "./mock-router";

/** 與正式站相同的打包目錄（Next 16 的 next dev 寫在 .next/dev，不互相覆蓋） */
export const E2E_DIST_DIR = ".next";
export const E2E_OUTPUT_ROOT = "test-results";

export function e2eServerEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: assertAllowedSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    // 社群功能（P3）預設關；E2E 要測到共鳴、回信、索引，預設開
    FEATURE_COMMUNITY: process.env.FEATURE_COMMUNITY ?? "on",
    ...mockRouterEnv(),
    // standalone server.js 會 chdir 到自己的目錄：路徑一律給絕對路徑
    IMPORT_E2E_FIXTURES: path.resolve("e2e/fixtures/import"),
    E2E_BLOCK_AUTH_EMAIL: isRemoteE2E() ? "on" : "off",
    // 測試觸發的降級警報只寫本地 log，不外推 webhook／LINE
    ALERT_WEBHOOK_URL: "",
    LINE_CHANNEL_ACCESS_TOKEN: "",
    LINE_TO: "",
    ALERT_LOG_PATH: path.resolve(E2E_OUTPUT_ROOT, "alerts.log"),
  };
}
