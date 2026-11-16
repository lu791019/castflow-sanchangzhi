/**
 * Voyage AI 詞向量客戶端（Q-48 拍板 Voyage，官方價目表已以 voyage-3.5 取代 voyage-3，同價同免費額度，1024 維）。
 * 逾時 15 秒；429／5xx 重試一次；錯誤訊息不帶金鑰。
 */

export const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
export const VOYAGE_MODEL = "voyage-3.5";
export const VOYAGE_DIM = 1024;
export const VOYAGE_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_000;

export type VoyageInputType = "document" | "query";

export interface Embedder {
  model: string;
  embed(texts: readonly string[], inputType: VoyageInputType): Promise<number[][]>;
}

export class VoyageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoyageError";
  }
}

export interface VoyageClientOptions {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

function isVoyageResponse(value: unknown): value is VoyageResponse {
  if (typeof value !== "object" || value === null) return false;
  const data = (value as { data?: unknown }).data;
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        Array.isArray((item as { embedding?: unknown }).embedding) &&
        typeof (item as { index?: unknown }).index === "number",
    )
  );
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseVectors(body: unknown, expected: number): number[][] {
  if (!isVoyageResponse(body)) throw new VoyageError("Voyage 回應格式不對");
  if (body.data.length !== expected) throw new VoyageError(`Voyage 回傳筆數不符：${body.data.length}／${expected}`);
  const sorted = [...body.data].sort((a, b) => a.index - b.index);
  if (sorted.some((item) => item.embedding.length !== VOYAGE_DIM)) {
    throw new VoyageError(`Voyage 回傳維度不對（預期 ${VOYAGE_DIM}）`);
  }
  return sorted.map((item) => item.embedding);
}

export function createVoyageClient(options: VoyageClientOptions): Embedder {
  const fetchFn = options.fetchFn ?? fetch;
  const model = options.model ?? VOYAGE_MODEL;
  const timeoutMs = options.timeoutMs ?? VOYAGE_TIMEOUT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function request(texts: readonly string[], inputType: VoyageInputType): Promise<Response> {
    return fetchFn(VOYAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts, model, input_type: inputType }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  return {
    model,
    async embed(texts, inputType) {
      if (texts.length === 0) return [];
      let response = await request(texts, inputType);
      if (shouldRetry(response.status)) {
        await sleep(RETRY_DELAY_MS);
        response = await request(texts, inputType);
      }
      if (!response.ok) throw new VoyageError(`Voyage 詞向量失敗：HTTP ${response.status}`);
      return parseVectors(await response.json(), texts.length);
    },
  };
}
