import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth/page";
import { JournalScreen } from "./journal-screen";
import { loadJournalScreen, type JournalSearchParams } from "./load-journal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "日誌｜散場誌",
};

export default async function JournalPage({ searchParams }: { searchParams: Promise<JournalSearchParams> }) {
  const userId = await requirePageUserId("/journal");
  return <JournalScreen {...await loadJournalScreen(userId, await searchParams)} />;
}
