"use client";

/**
 * 散場之前卡片主鈕「排進行程」：開記一筆 sheet，預選作品並切到「選日期時間」。
 * 電影／影集只有 TMDB id → 先 POST /api/works 取得作品；場外直接帶名稱＋場地＋日期（server 依名稱＋日期歸回同一本場刊）。
 */

import { useState } from "react";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { toRecent, type LogSheetPrefill } from "@/components/journal/log-sheet";
import { createWork } from "@/components/work-picker/client";
import type { PlanTarget } from "@/lib/before/cards";
import { EMPTY_LIVE_DRAFT } from "@/components/journal/live-fields";

export const PLAN_BUTTON =
  "hit-44 flex min-h-9 items-center rounded-control bg-ink-950 px-3 text-caption font-bold text-paper disabled:bg-action-disabled-bg disabled:text-action-disabled-fg";

async function prefillFor(plan: PlanTarget): Promise<LogSheetPrefill> {
  if (plan.type === "live") {
    return {
      place: plan.place,
      live: { ...EMPTY_LIVE_DRAFT, name: plan.name, venue: plan.venue, dates: plan.dates },
      when: "custom",
      custom: plan.custom,
    };
  }
  const work = await createWork({ source: "tmdb", kind: plan.kind, tmdbId: plan.tmdbId });
  // 上映中的電影多半進戲院、影集多半在家；sheet 裡可以改
  return { work: toRecent(work), place: plan.kind === "movie" ? "cinema" : "home", when: "custom" };
}

export function PlanButton({ plan, title }: { plan: PlanTarget; title: string }) {
  const { openLogSheet } = useLogSheet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      openLogSheet({ prefill: await prefillFor(plan) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暫時排不進去，再按一次");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} disabled={busy} aria-label={`排進行程：${title}`} className={PLAN_BUTTON}>
        {busy ? "準備中…" : "排進行程"}
      </button>
      {error ? (
        <span role="alert" className="basis-full text-eyebrow text-destructive">
          {error}
        </span>
      ) : null}
    </>
  );
}
