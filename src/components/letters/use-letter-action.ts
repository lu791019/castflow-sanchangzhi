"use client";

/** 來信單封的動作：PATCH /api/letters/[id]，成功後重新整理伺服器資料 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface LetterActionBody {
  action: "publish" | "keep" | "unpublish" | "reply" | "report" | "block" | "unblock";
  reply?: string;
}

export function useLetterAction(letterId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(body: LetterActionBody): Promise<boolean> {
    setError(null);
    try {
      const response = await fetch(`/api/letters/${letterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "沒有處理成功，等一下再試");
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("網路好像斷了，等一下再試");
      return false;
    }
  }

  return { run, pending, error };
}
