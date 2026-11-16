/** 跑完：清掉本套件測試資料，並確認非測試活動筆數與開跑前相同（不同就讓整輪失敗） */

import { BASELINE_ENV } from "./global-setup";
import { countRealEvents, describeSweep, sweepSuiteData } from "./fixtures/sweep";

export default async function globalTeardown(): Promise<void> {
  const message = describeSweep("跑完", await sweepSuiteData());
  if (message) process.stdout.write(`${message}\n`);
  const baseline = Number(process.env[BASELINE_ENV]);
  const now = await countRealEvents();
  if (Number.isFinite(baseline) && now !== baseline) {
    throw new Error(`[e2e] 非測試活動筆數變了：開跑前 ${baseline}、現在 ${now}（測試不該動到真資料，請查）`);
  }
  process.stdout.write(`[e2e] 非測試活動 ${now} 筆，與開跑前相同\n`);
}
