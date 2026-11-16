import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth/page";
import { loadJournalForSay } from "@/lib/journal/say-context";
import { loadLatestUnsaid } from "@/lib/say/cards-repository";
import { WatchedForm, type WatchedWorkChoice } from "./watched-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "看完了｜散場誌",
  robots: { index: false },
};

/** 最近一筆「看過、還沒說」的日誌（含排好的行程散場後轉成的）預帶進來（Q-69） */
async function loadPrefill(userId: string): Promise<WatchedWorkChoice | null> {
  const latest = await loadLatestUnsaid(userId);
  if (!latest?.journalId) return null;
  const context = await loadJournalForSay(userId, latest.journalId);
  if (!context) return null;
  return {
    journalId: latest.journalId,
    workId: context.work?.id ?? null,
    title: context.workTitle,
    kind: context.work?.kind ?? null,
    posterUrl: context.work?.poster_url ?? null,
    note: "從你的日誌帶入",
  };
}

export default async function WatchedPage() {
  const userId = await requirePageUserId("/watched");
  const prefill = await loadPrefill(userId);
  return <WatchedForm prefill={prefill} />;
}
