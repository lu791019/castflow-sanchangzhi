"use client";

/**
 * delete.undo：確認刪除後先從畫面拿掉，5 秒內可「復原」；時間到才真的呼叫 API。
 * 期間離開頁面（pagehide / 卸載）立刻以 keepalive 送出，不讓刪除默默失效。
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const UNDO_MS = 5000;

type Toast = { kind: "undo"; id: string } | { kind: "error"; message: string } | null;

async function sendDelete(id: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/me/drafts/${id}`, { method: "DELETE", keepalive: true });
    if (response.ok) return null;
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? "沒有刪成，稍後再試一次";
  } catch {
    return "連不上，沒有刪成";
  }
}

export function useDeferredDelete() {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<Toast>(null);
  const pending = useRef(new Map<string, number>());

  const restore = useCallback((id: string) => {
    setHidden((current) => new Set([...current].filter((item) => item !== id)));
  }, []);

  const commit = useCallback(
    async (id: string) => {
      pending.current.delete(id);
      setToast((current) => (current?.kind === "undo" && current.id === id ? null : current));
      const error = await sendDelete(id);
      if (error) {
        restore(id);
        setToast({ kind: "error", message: error });
      }
    },
    [restore],
  );

  const drop = useCallback(
    (id: string) => {
      setHidden((current) => new Set([...current, id]));
      setToast({ kind: "undo", id });
      const timer = window.setTimeout(() => void commit(id), UNDO_MS);
      pending.current.set(id, timer);
    },
    [commit],
  );

  const undo = useCallback(() => {
    if (toast?.kind !== "undo") return;
    window.clearTimeout(pending.current.get(toast.id));
    pending.current.delete(toast.id);
    restore(toast.id);
    setToast(null);
  }, [restore, toast]);

  useEffect(() => {
    const queue = pending.current;
    const flush = () => {
      for (const [id, timer] of queue) {
        window.clearTimeout(timer);
        void sendDelete(id);
      }
      queue.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return { hidden, toast, drop, undo, dismissError: () => setToast(null) };
}
