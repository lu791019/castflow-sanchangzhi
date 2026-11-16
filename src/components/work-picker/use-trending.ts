"use client";

/** 本週熱門：依類型抓一次、整個分頁期間共用（server 已快取一小時）；失敗只記 console，面板照常可搜 */

import { useEffect, useState } from "react";
import type { PickerKind } from "@/lib/work-picker/types";
import type { TrendingPayload } from "@/lib/trending/types";
import { fetchTrending, isAbortError } from "./client";

export type TrendingState =
  | { status: "loading"; payload: null }
  | { status: "ready"; payload: TrendingPayload }
  | { status: "error"; payload: null };

const loaded = new Map<PickerKind, TrendingPayload>();

/** 狀態只記「哪個類型、結果如何」；切類型時由 render 端比對 kind 得出 loading，不在 effect 裡同步 setState */
export function useTrending(kind: PickerKind): TrendingState {
  const [settled, setSettled] = useState<{ kind: PickerKind; state: TrendingState } | null>(null);

  useEffect(() => {
    if (loaded.has(kind)) return;
    const controller = new AbortController();
    fetchTrending(kind, controller.signal)
      .then((payload) => {
        loaded.set(kind, payload);
        setSettled({ kind, state: { status: "ready", payload } });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error("[work-picker] trending failed", error instanceof Error ? error.message : error);
        setSettled({ kind, state: { status: "error", payload: null } });
      });
    return () => controller.abort();
  }, [kind]);

  const cached = loaded.get(kind);
  if (cached) return { status: "ready", payload: cached };
  if (settled?.kind === kind) return settled.state;
  return { status: "loading", payload: null };
}
