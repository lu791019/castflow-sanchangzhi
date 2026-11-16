"use client";

/** 搜尋狀態機：debounce 300ms、2 字門檻、序號比對 + AbortController 丟掉過期回應 */

import { useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS, createSequencer, normalizeQuery, queryGate } from "@/lib/work-picker/query";
import type { PickerKind, SearchResult } from "@/lib/work-picker/types";
import { fetchSearch, isAbortError } from "./client";

export type SearchStatus = "empty" | "too_short" | "loading" | "ready" | "error";

export interface SearchState {
  status: SearchStatus;
  /** 這批結果對應的查詢字（顯示「「海街」・4 筆結果」用） */
  query: string;
  results: SearchResult[];
  error: string | null;
}

interface Settled {
  key: string;
  status: "ready" | "error";
  results: SearchResult[];
  error: string | null;
}

function requestKey(kind: PickerKind, query: string, retryToken: number): string {
  return `${kind}\u0000${query}\u0000${retryToken}`;
}

/**
 * 回傳的狀態由「目前輸入」與「最後落地的回應」推導：
 * 門檻不過 → empty / too_short；回應 key 與目前輸入不符 → loading；符合 → ready / error。
 * 效應本身只排程與取消，setState 只在 timer / promise 回呼內發生。
 */
export function useWorkSearch(kind: PickerKind, rawQuery: string, retryToken = 0): SearchState {
  const [settled, setSettled] = useState<Settled | null>(null);
  const sequencer = useRef(createSequencer());
  const controller = useRef<AbortController | null>(null);

  const query = normalizeQuery(rawQuery);
  const gate = queryGate(query);
  const key = requestKey(kind, query, retryToken);

  useEffect(() => {
    controller.current?.abort();
    if (gate !== "ok") {
      sequencer.current.invalidate();
      return;
    }
    const timer = window.setTimeout(() => {
      const id = sequencer.current.next();
      const abort = new AbortController();
      controller.current = abort;
      fetchSearch(kind, query, abort.signal)
        .then((results) => {
          if (!sequencer.current.isLatest(id)) return;
          setSettled({ key, status: "ready", results, error: null });
        })
        .catch((error: unknown) => {
          if (isAbortError(error) || !sequencer.current.isLatest(id)) return;
          const message = error instanceof Error ? error.message : "暫時搜不到，再試一次";
          setSettled({ key, status: "error", results: [], error: message });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [kind, query, gate, key]);

  useEffect(() => () => controller.current?.abort(), []);

  if (gate !== "ok") return { status: gate, query, results: [], error: null };
  if (!settled || settled.key !== key) return { status: "loading", query, results: [], error: null };
  return { status: settled.status, query, results: settled.results, error: settled.error };
}
