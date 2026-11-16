/**
 * 全套件前後的清理（globalSetup／globalTeardown）：只掃本套件前綴的資料，非測試資料一律不碰。
 * - 帳號：e2e+…@example.com 且符合 TEST_EMAIL_PREFIX（連同該帳號的集數、日誌、設定、音檔）
 * - 活動：events.source_id 以 e2e- 開頭
 * - 作品：slug 以 e2e- 開頭（seed 直接建的）
 */

import { rest, restDeleteWhere, sweepTestUsers } from "./admin";
import { countEvents, deleteTestEvents, TEST_EVENT_PREFIX } from "./events-table";

export interface SweepResult {
  users: number;
  events: number;
  works: number;
}

const TEST_WORK_SLUG = "e2e-";

export async function sweepSuiteData(): Promise<SweepResult> {
  const users = await sweepTestUsers();
  const events = await countEvents(`source_id=like.${TEST_EVENT_PREFIX}*`);
  if (events > 0) await deleteTestEvents();
  const works = (await rest<{ id: string }>("works", `select=id&slug=like.${TEST_WORK_SLUG}*`)).length;
  if (works > 0) await restDeleteWhere("works", `slug=like.${TEST_WORK_SLUG}*`);
  return { users, events, works };
}

export function describeSweep(label: string, result: SweepResult): string | null {
  const parts = [
    result.users > 0 ? `${result.users} 個測試帳號` : null,
    result.events > 0 ? `${result.events} 筆測試活動` : null,
    result.works > 0 ? `${result.works} 部測試作品` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `[e2e] ${label}清掉 ${parts.join("、")}` : null;
}

/** 非測試活動筆數（開跑前記下，跑完比對；不同就代表有人動到真資料） */
export function countRealEvents(): Promise<number> {
  return countEvents(`source_id=not.like.${TEST_EVENT_PREFIX}*`);
}
