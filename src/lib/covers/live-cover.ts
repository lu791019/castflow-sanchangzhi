/**
 * 記一筆場外的「封面」寫進場刊（server only）：與場刊「補封面」走同一條流程（submit-service）——
 * 外部網址 server 轉存、白名單才直接補空的 poster_url、其餘待審。任何失敗推警報、不擋記一筆（沒圖就走字卡）。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { submitWorkCover } from "./submit-service";

export async function saveLiveCover(workId: string, userId: string, url: string): Promise<void> {
  try {
    const result = await submitWorkCover({ workId, userId, url });
    // fetch_failed 已在流程內推過警報；invalid 在這裡補推（記一筆入口已先驗過網址，理論上不會發生）
    if (!result.ok && result.reason === "invalid") {
      void getServerNotify()("warn", "記一筆場外封面網址被擋", `work=${workId} ${result.error}`).catch(() => undefined);
    }
  } catch (error) {
    const detail = `work=${workId} ${error instanceof Error ? error.message : String(error)}`;
    console.error("[covers] 場刊封面寫入失敗", detail);
    void getServerNotify()("warn", "場刊封面寫入失敗", detail).catch(() => undefined);
  }
}
