"use client";

/**
 * 散場之前音樂榜單卡的主鈕「排進行程」：按下去才建專輯作品（iTunes lookup），
 * 再開記一筆（在家、切到「選日期時間」），跟 Podcast 排行程同一條路（podcast-plan-button.tsx）。
 */

import { useState } from "react";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { toRecent } from "@/components/journal/log-sheet";
import { createWork } from "@/components/work-picker/client";
import type { MusicPlan } from "@/lib/before/cards";
import { PLAN_BUTTON } from "./plan-button";

const NOT_READY = "這張專輯暫時讀不到，再按一次";

export function MusicPlanButton({ plan }: { plan: MusicPlan }) {
  const { openLogSheet } = useLogSheet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const work = await createWork({ source: "music", itunesId: plan.itunesId });
      openLogSheet({ prefill: { work: toRecent(work), place: "home", when: "custom" } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : NOT_READY);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} disabled={busy} aria-label={`排進行程：${plan.title}`} className={PLAN_BUTTON}>
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
