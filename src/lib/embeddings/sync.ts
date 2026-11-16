/**
 * 詞向量同步（存取層以 EmbeddingStore 注入，測試用假 store）：
 * - syncEpisodeEmbedding：發佈／改內文／改設定後算一篇；不再符合就刪列
 * - refreshEmbeddings：worker 每輪補算最多 REFRESH_LIMIT 篇沒算過或 hash 過期的
 * 沒有 VOYAGE_API_KEY（embedder 為 null）時不丟錯，通知一次後略過。
 */

import { contentHash } from "./text";
import { VOYAGE_MODEL, type Embedder } from "./voyage";

export const REFRESH_LIMIT = 10;
/** 每輪核對 hash 的篇數（沒算過的排前面，其次最久沒核對的） */
export const QUEUE_SCAN_LIMIT = 50;

export interface EmbeddingSource {
  episodeId: string;
  eligible: boolean;
  /** buildEmbeddingText 的結果 */
  text: string;
  storedHash: string | null;
}

export interface EmbeddingRow {
  episodeId: string;
  model: string;
  embedding: number[];
  contentHash: string;
}

export interface EmbeddingStore {
  loadSource(episodeId: string): Promise<EmbeddingSource | null>;
  loadQueue(limit: number): Promise<EmbeddingSource[]>;
  upsert(row: EmbeddingRow): Promise<void>;
  remove(episodeId: string): Promise<void>;
  markChecked(episodeIds: readonly string[]): Promise<void>;
}

export interface EmbeddingDeps {
  store: EmbeddingStore;
  /** null＝沒有 VOYAGE_API_KEY */
  embedder: Embedder | null;
  onMissingKey: () => void;
}

export type EmbeddingPlan =
  | { action: "embed"; hash: string }
  | { action: "unchanged" }
  | { action: "delete" }
  | { action: "ignore" };

export function planEmbedding(source: EmbeddingSource, model: string): EmbeddingPlan {
  if (!source.eligible || !source.text) return source.storedHash ? { action: "delete" } : { action: "ignore" };
  const hash = contentHash(model, source.text);
  return hash === source.storedHash ? { action: "unchanged" } : { action: "embed", hash };
}

export type SyncOutcome = "embedded" | "unchanged" | "deleted" | "ignored" | "no_key";

export async function syncEpisodeEmbedding(deps: EmbeddingDeps, episodeId: string): Promise<SyncOutcome> {
  const source = await deps.store.loadSource(episodeId);
  if (!source) return "ignored";
  const plan = planEmbedding(source, deps.embedder?.model ?? VOYAGE_MODEL);
  if (plan.action === "delete") {
    await deps.store.remove(episodeId);
    return "deleted";
  }
  if (plan.action === "ignore") return "ignored";
  if (plan.action === "unchanged") return "unchanged";
  if (!deps.embedder) {
    deps.onMissingKey();
    return "no_key";
  }
  const [embedding] = await deps.embedder.embed([source.text], "document");
  await deps.store.upsert({ episodeId, model: deps.embedder.model, embedding, contentHash: plan.hash });
  return "embedded";
}

export interface RefreshResult {
  scanned: number;
  embedded: number;
  /** 沒有 key 而略過的 */
  skipped: number;
  failed: number;
  errors: string[];
}

interface Pending {
  source: EmbeddingSource;
  hash: string;
}

function splitQueue(queue: readonly EmbeddingSource[], model: string): { pending: Pending[]; unchanged: string[] } {
  const planned = queue.map((source) => ({ source, plan: planEmbedding(source, model) }));
  return {
    pending: planned.flatMap(({ source, plan }) => (plan.action === "embed" ? [{ source, hash: plan.hash }] : [])),
    unchanged: planned.filter(({ plan }) => plan.action === "unchanged").map(({ source }) => source.episodeId),
  };
}

export async function refreshEmbeddings(deps: EmbeddingDeps): Promise<RefreshResult> {
  const model = deps.embedder?.model ?? VOYAGE_MODEL;
  const { pending: all, unchanged } = splitQueue(await deps.store.loadQueue(QUEUE_SCAN_LIMIT), model);
  if (unchanged.length > 0) await deps.store.markChecked(unchanged);
  const pending = all.slice(0, REFRESH_LIMIT);
  const empty: RefreshResult = { scanned: pending.length, embedded: 0, skipped: 0, failed: 0, errors: [] };
  if (pending.length === 0) return empty;
  if (!deps.embedder) {
    deps.onMissingKey();
    return { ...empty, skipped: pending.length };
  }
  try {
    const vectors = await deps.embedder.embed(
      pending.map((item) => item.source.text),
      "document",
    );
    const embedder = deps.embedder;
    await Promise.all(
      pending.map((item, index) =>
        deps.store.upsert({ episodeId: item.source.episodeId, model: embedder.model, embedding: vectors[index], contentHash: item.hash }),
      ),
    );
    return { ...empty, embedded: pending.length };
  } catch (error) {
    return { ...empty, failed: pending.length, errors: [error instanceof Error ? error.message : String(error)] };
  }
}
