/**
 * E2E（Playwright）：先打包（next build，standalone）再以正式站同樣的 node server.js 起在 port 3020（e2e/server.ts），測試期間不即時編譯。
 * - env 用 @next/env 依 next dev 相同優先序載入（.env.development.local 覆蓋 .env.local）；webServer 會原樣帶給 build 與 start
 * - Supabase 目標：本地直接放行；雲端要 E2E_REMOTE_REF=<project ref> 明確同意（見 e2e/fixtures/env.ts）
 * - 遠端模式：伺服器帶 E2E_BLOCK_AUTH_EMAIL=on（「寄連結給我」不呼叫 signInWithOtp）、登入走 admin generateLink
 * - 外部服務（TMDB／文化部／Apple／iTunes）一律指到 globalSetup 起的路由（e2e/fixtures/mock-router.ts）
 * - workers 1：共用同一個 DB
 * 執行：
 *   E2E_REMOTE_REF=<ref> npm run e2e                      打包＋啟動＋跑全部（打包產物在 .next/，與正式站相同）
 *   E2E_SKIP_BUILD=1 E2E_REMOTE_REF=<ref> npm run e2e     沿用上次打包，只啟動
 *   E2E_REUSE_SERVER=1 E2E_REMOTE_REF=<ref> npm run e2e   不起伺服器，打已經在 E2E_PORT 跑的（用 `npm run e2e:server` 起，env 相同）
 */

import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { BASE_URL } from "./e2e/fixtures/env";
import { e2eServerEnv, E2E_OUTPUT_ROOT as OUTPUT_ROOT } from "./e2e/fixtures/server-env";

loadEnvConfig(process.cwd(), true);

// 沒被明確同意的 Supabase（雲端沒設 E2E_REMOTE_REF）在這裡就擋下
const serverEnv = e2eServerEnv();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: `${OUTPUT_ROOT}/artifacts`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  // 打字送出要等 LLM 整理（20–30 秒）、錄音要等轉錄
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: `${OUTPUT_ROOT}/report` }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 375, height: 812 },
    locale: "zh-TW",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer:
    process.env.E2E_REUSE_SERVER === "1"
      ? undefined
      : {
          command: "npm run e2e:server",
          url: `${BASE_URL}/login`,
          reuseExistingServer: false,
          // 打包約數分鐘（8GB 機器更久）
          timeout: 900_000,
          stdout: "ignore",
          stderr: "pipe",
          env: serverEnv,
        },
});
