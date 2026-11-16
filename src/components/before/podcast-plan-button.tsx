"use client";

/**
 * 散場之前 Podcast 榜單卡的主鈕「排進行程」：作品是單集，按下去才讀節目 RSS、預選最新一集，
 * 建好作品後開記一筆（在家、切到「選日期時間」），跟電影／影集排行程同一條路，真的記進日誌。
 * 樣式沿用 PlanButton（plan-button.tsx 由 uxread 維護，這裡只借它的 class）。
 */

import { useState } from "react";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { toRecent } from "@/components/journal/log-sheet";
import { createWork, fetchEpisodes } from "@/components/work-picker/client";
import type { PodcastPlan } from "@/lib/before/cards";
import { latestEpisode } from "@/lib/before/podcast-cards";
import { PLAN_BUTTON } from "./plan-button";

const NO_EPISODE = "這個節目暫時讀不到集數，再按一次";

export function PodcastPlanButton({ plan }: { plan: PodcastPlan }) {
  const { openLogSheet } = useLogSheet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { episodes } = await fetchEpisodes(plan.feedUrl, AbortSignal.timeout(20_000));
      const episode = latestEpisode(episodes);
      if (!episode) throw new Error(NO_EPISODE);
      const work = await createWork({ source: "podcast", feedUrl: plan.feedUrl, guid: episode.guid, itunesId: plan.itunesId });
      openLogSheet({ prefill: { work: toRecent(work), place: "home", when: "custom" } });
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : NO_EPISODE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} disabled={busy} aria-label={`排進行程：${plan.show}`} className={PLAN_BUTTON}>
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
