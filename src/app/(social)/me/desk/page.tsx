import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth/page";
import { buildDesk, parseDeskTab } from "@/lib/me/desk";
import { loadDeskRows } from "@/lib/me/desk-repository";
import { rescheduleSlots } from "@/lib/me/schedule";
import { formatMastheadDate } from "@/lib/feed/entries";
import { DeskView } from "./desk-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "編輯檯｜散場誌",
  robots: { index: false },
};

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const userId = await requirePageUserId("/me/desk");
  const params = await searchParams;
  const tab = parseDeskTab(Array.isArray(params.tab) ? params.tab[0] : params.tab);
  const now = new Date();
  const desk = buildDesk(await loadDeskRows(userId), now);

  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950">
        <span className="text-eyebrow tracking-[0.14em] text-ink-600 tabular-nums">
          我的・{formatMastheadDate(now)}
        </span>
      </header>
      <DeskView
        desk={desk}
        initialTab={tab}
        slots={rescheduleSlots(now)}
        nowIso={now.toISOString()}
      />
    </>
  );
}
