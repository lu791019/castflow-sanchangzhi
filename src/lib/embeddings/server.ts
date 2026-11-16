/**
 * 詞向量的 server 端接線：依環境變數組 deps、文章發佈／更新後非同步算（after，不擋回應）。
 * 失敗推 warn 不擋發佈；沒有 VOYAGE_API_KEY 時整個 process 只通知一次。
 */

import { after } from "next/server";
import { getServerNotify } from "@/lib/alerts/notify";
import { createOnceWarner, readVoyageKey } from "./config";
import { createSupabaseEmbeddingStore } from "./repository";
import { syncEpisodeEmbedding, type EmbeddingDeps } from "./sync";
import { createVoyageClient } from "./voyage";

const warnMissingKey = createOnceWarner(() => {
  console.warn("[embeddings] 沒有 VOYAGE_API_KEY，詞向量略過；同好配對只用共同作品");
  void getServerNotify()(
    "warn",
    "詞向量停用：沒有 VOYAGE_API_KEY",
    "同好配對先只用共同作品；key 進 Secret Manager 與 Cloud Run env 後自動恢復",
  ).catch(() => undefined);
});

export function createServerEmbeddingDeps(): EmbeddingDeps {
  const apiKey = readVoyageKey();
  return {
    store: createSupabaseEmbeddingStore(),
    embedder: apiKey ? createVoyageClient({ apiKey }) : null,
    onMissingKey: warnMissingKey,
  };
}

/** 回應送出後再算這篇的詞向量；失敗只推警報 */
export function scheduleEmbeddingSync(episodeId: string): void {
  after(async () => {
    try {
      await syncEpisodeEmbedding(createServerEmbeddingDeps(), episodeId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[embeddings] 文章詞向量計算失敗", { episodeId, detail });
      await getServerNotify()("warn", "文章詞向量計算失敗（不影響發佈）", `${episodeId}：${detail}`).catch(() => undefined);
    }
  });
}
