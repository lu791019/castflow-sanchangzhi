/** 匯入頁的排隊（純函式，不 mutate）：可一次貼多篇，一次只抓一篇 */

import type { ImportPreview, ImportedRef } from "./types";

export type QueueState =
  | { kind: "queued" }
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "duplicate"; existing: ImportedRef }
  | { kind: "ready"; preview: ImportPreview }
  | { kind: "done"; article: ImportedRef };

export interface QueueItem {
  id: string;
  rawUrl: string;
  state: QueueState;
}

export const MAX_QUEUE = 20;

export function splitPastedUrls(text: string): string[] {
  const parts = text.split(/[\s,，]+/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts)];
}

export function addUrls(queue: readonly QueueItem[], text: string, makeId: () => string): QueueItem[] {
  const existing = new Set(queue.map((item) => item.rawUrl));
  const fresh = splitPastedUrls(text)
    .filter((url) => !existing.has(url))
    .slice(0, Math.max(0, MAX_QUEUE - queue.length))
    .map((rawUrl): QueueItem => ({ id: makeId(), rawUrl, state: { kind: "queued" } }));
  return [...queue, ...fresh];
}

export function nextQueued(queue: readonly QueueItem[]): QueueItem | null {
  if (queue.some((item) => item.state.kind === "loading")) return null;
  return queue.find((item) => item.state.kind === "queued") ?? null;
}

export function updateItem(queue: readonly QueueItem[], id: string, state: QueueState): QueueItem[] {
  return queue.map((item) => (item.id === id ? { ...item, state } : item));
}

export function removeItem(queue: readonly QueueItem[], id: string): QueueItem[] {
  return queue.filter((item) => item.id !== id);
}
