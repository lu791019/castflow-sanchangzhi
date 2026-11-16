import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth/page";
import { safeNextPath } from "@/lib/auth/paths";
import { loadJournalForSay } from "@/lib/journal/say-context";
import { buildReminderCopy, computeRemindAt } from "@/lib/journal/remind";
import { VENUE_LABELS } from "@/lib/journal/types";
import { EnableNotifications, type FirstEntryCard } from "./enable-notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "收到提醒｜散場誌",
};

/** 沒有帶紀錄時的示意推播（設計稿原文） */
const SAMPLE_PREVIEW = { title: "昨晚的《海街日記》", body: "看完一天了，現在想說說嗎？說一分鐘就好。" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 通知權限引導（設計稿「通知權限引導」「iPhone 加入主畫面引導」）。
 * 記一筆後第一次會帶 ?entry=<id>（顯示「你的第一筆」）；設定頁也連過來（不帶）。
 */
export default async function EnableNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string | string[]; next?: string | string[] }>;
}) {
  const userId = await requirePageUserId("/notifications/enable");
  const params = await searchParams;
  const context = await loadJournalForSay(userId, first(params.entry));

  let card: FirstEntryCard | null = null;
  let preview = SAMPLE_PREVIEW;
  if (context) {
    const experiencedAt = new Date(context.entry.experienced_at);
    const askedAt = computeRemindAt(experiencedAt, "next_noon") ?? new Date();
    card = { title: context.workTitle, place: VENUE_LABELS[context.entry.venue], posterUrl: context.work?.poster_url ?? null };
    preview = buildReminderCopy({
      workTitle: context.workTitle,
      kind: context.work?.kind ?? null,
      experiencedAt,
      venue: context.entry.venue,
      askedAt,
    });
  }

  return <EnableNotifications card={card} preview={preview} backHref={safeNextPath(first(params.next), "/journal")} />;
}
