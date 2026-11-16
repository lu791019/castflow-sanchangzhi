/**
 * 開跑前：
 * 1. 清掉上次中斷殘留的本套件測試資料（帳號 e2e+pw-…@example.com、events source_id e2e-*、作品 slug e2e-*）
 * 2. 記下非測試活動筆數（globalTeardown 比對，不同就讓整輪失敗）
 * 3. 起外部服務路由（TMDB／文化部／Apple／iTunes 轉給各 spec 的假 server，見 fixtures/mock-router.ts）
 */

import { startMockRouter, type MockRouter } from "./fixtures/mock-router";
import { countRealEvents, describeSweep, sweepSuiteData } from "./fixtures/sweep";

export const BASELINE_ENV = "E2E_BASELINE_REAL_EVENTS";

let router: MockRouter | null = null;

export async function stopMockRouter(): Promise<void> {
  await router?.close();
  router = null;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const message = describeSweep("開跑前", await sweepSuiteData());
  if (message) process.stdout.write(`${message}\n`);
  process.env[BASELINE_ENV] = String(await countRealEvents());
  router = await startMockRouter();
  return stopMockRouter;
}
