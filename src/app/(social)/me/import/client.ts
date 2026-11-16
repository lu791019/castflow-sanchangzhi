/** 瀏覽器端呼叫 /api/import/*；錯誤統一轉成畫面要的狀態 */

import type { QueueState } from "@/lib/import/queue";
import type { ImportedRef, ImportPreview } from "@/lib/import/types";

interface Envelope {
  success?: boolean;
  error?: string;
  data?: { status?: string; preview?: ImportPreview; existing?: ImportedRef; article?: ImportedRef };
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: Envelope }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: Envelope = {};
  try {
    json = (await response.json()) as Envelope;
  } catch {
    json = {};
  }
  return { ok: response.ok, status: response.status, json };
}

function failure(json: Envelope, fallback: string): QueueState {
  if (json.data?.status === "duplicate" && json.data.existing) return { kind: "duplicate", existing: json.data.existing };
  return { kind: "error", error: json.error ?? fallback };
}

export async function requestPreview(url: string): Promise<QueueState> {
  try {
    const { ok, json } = await post("/api/import/preview", { url });
    if (ok && json.data?.preview) return { kind: "ready", preview: json.data.preview };
    return failure(json, "讀取文章失敗，再試一次");
  } catch {
    return { kind: "error", error: "連不上，檢查網路後再試一次" };
  }
}

export async function requestCommit(input: { url: string; workId: string; confirmed: boolean }): Promise<QueueState> {
  try {
    const { ok, json } = await post("/api/import", input);
    if (ok && json.data?.article) return { kind: "done", article: json.data.article };
    return failure(json, "搬文章失敗，再試一次");
  } catch {
    return { kind: "error", error: "連不上，檢查網路後再試一次" };
  }
}
