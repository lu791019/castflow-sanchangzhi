/** 詞向量補算一輪（常駐 worker 與 worker:enrich 共用）：打 app API，失敗推 warn 不中斷 */

import type { AppApi } from "./api.ts";
import type { Notify } from "./notify.ts";

export async function refreshEmbeddings(api: Pick<AppApi, "refreshEmbeddings">, notify: Notify, log: (line: string) => void): Promise<void> {
  try {
    const result = await api.refreshEmbeddings();
    if (result.scanned > 0) {
      log(`詞向量補算：待算 ${result.scanned}、算好 ${result.embedded}、沒 key 略過 ${result.skipped}、失敗 ${result.failed}`);
    }
    if (result.failed > 0) {
      await notify("warn", "詞向量補算部分失敗", result.errors.slice(0, 5).join("；"));
    }
  } catch (error) {
    await notify("warn", "詞向量補算失敗（app API 無法呼叫？）", error instanceof Error ? error.message : String(error));
  }
}
