/** 瀏覽器端呼叫 /api/works/*；錯誤統一拋 Error(使用者看得到的訊息) */

import type {
  CreateWorkInput,
  PickerKind,
  PickerWork,
  PodcastEpisodesPayload,
  SearchResult,
} from "@/lib/work-picker/types";
import type { TrendingPayload } from "@/lib/trending/types";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function readEnvelope<T>(response: Response, fallback: string): Promise<T> {
  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }
  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error ?? fallback);
  }
  return body.data;
}

export async function fetchSearch(
  kind: PickerKind,
  query: string,
  signal: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ kind, q: query });
  const response = await fetch(`/api/works/search?${params}`, { signal });
  const data = await readEnvelope<{ results: SearchResult[] }>(response, "暫時搜不到，再試一次");
  return data.results;
}

export async function fetchEpisodes(feedUrl: string, signal: AbortSignal): Promise<PodcastEpisodesPayload> {
  const params = new URLSearchParams({ feed: feedUrl });
  const response = await fetch(`/api/works/episodes?${params}`, { signal });
  return readEnvelope<PodcastEpisodesPayload>(response, "暫時讀不到集數，再試一次");
}

export async function fetchRecent(signal: AbortSignal): Promise<PickerWork[]> {
  const response = await fetch("/api/works", { signal });
  const data = await readEnvelope<{ recent: PickerWork[] }>(response, "讀取最近作品失敗");
  return data.recent;
}

export async function createWork(input: CreateWorkInput): Promise<PickerWork> {
  const response = await fetch("/api/works", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readEnvelope<{ work: PickerWork }>(response, "建立作品失敗，再試一次");
  return data.work;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchTrending(kind: PickerKind, signal: AbortSignal): Promise<TrendingPayload> {
  const params = new URLSearchParams({ kind });
  const response = await fetch(`/api/works/trending?${params}`, { signal });
  return readEnvelope<TrendingPayload>(response, "本週熱門暫時讀不到");
}
