/**
 * events 表（多來源藝文活動）的 E2E 工具：直接打 PostgREST（service role）。
 * 只動測試種的活動（source_id 以 e2e- 開頭）：雲端有真收集的活動，絕不刪、不改、不暫存搬移。
 * 測試卡片被真活動擠出散場之前的上限時，改用篩選條件（縣市、細分類）或日期縮小範圍找自己的卡，不動真資料。
 */

import { serviceRoleKey, supabaseUrl } from "./env";

export const TEST_EVENT_PREFIX = "e2e-";

export async function eventsTable(query: string, init: RequestInit = {}): Promise<Response> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/events?${query}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers as Record<string, string>) },
  });
  if (!response.ok) throw new Error(`[e2e events] ${init.method ?? "GET"} events?${query} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response;
}

/** 刪掉測試種的活動；runPrefix 給定時只刪那一輪（例：e2e-abc12-）。前綴必須以 e2e- 開頭 */
export async function deleteTestEvents(runPrefix = TEST_EVENT_PREFIX): Promise<void> {
  if (!runPrefix.startsWith(TEST_EVENT_PREFIX)) throw new Error(`[e2e events] 只刪 ${TEST_EVENT_PREFIX} 開頭的測試活動：${runPrefix}`);
  await eventsTable(`source_id=like.${encodeURIComponent(`${runPrefix}*`)}`, { method: "DELETE" });
}

/** 筆數（Prefer count=exact）；filter 例：source_id=not.like.e2e-* */
export async function countEvents(filter = ""): Promise<number> {
  const response = await eventsTable(`select=id${filter ? `&${filter}` : ""}`, { method: "HEAD", headers: { Prefer: "count=exact" } });
  const total = Number(response.headers.get("content-range")?.split("/")[1]);
  if (!Number.isFinite(total)) throw new Error("[e2e events] 讀不到筆數");
  return total;
}
