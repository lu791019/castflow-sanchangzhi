import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeQuoteParam } from "@/lib/say/quote";
import { getCurrentUserId } from "@/lib/auth/session";
import { loginRedirectPath } from "@/lib/auth/paths";
import { isPodcast, KIND_LABELS, workVerb, type Work } from "@/lib/works/format";
import { findWorkBySlug } from "@/lib/works/repository";
import { loadJournalForSay } from "@/lib/journal/say-context";
import { toJournalPrefill } from "@/lib/say/journal-prefill";
import { buildSayCards } from "@/lib/say/cards";
import { loadLatestUnsaid, loadRecentEpisodeCards } from "@/lib/say/cards-repository";
import { SayStage, type RecentWork } from "./say-stage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "說一段｜散場誌",
};

/** 從作品特輯 CTA 進來（/say?work=<slug>）：預帶該作品為作品卡 */
function toPrefilledWork(work: Work): RecentWork {
  const podcast = isPodcast(work);
  return {
    id: work.id,
    workId: work.id,
    title: work.title,
    workTitle: podcast && work.podcast_show ? work.podcast_show : work.title,
    categoryLabel: KIND_LABELS[work.kind],
    createdAt: new Date().toISOString(),
    verb: workVerb(work),
    note: podcast ? work.title : "已從作品特輯帶入",
    posterUrl: work.poster_url,
  };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toQueryString(params: Record<string, string | string[] | undefined>): string {
  return new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : value ? [value] : []).map((v) => [key, v] as [string, string]),
    ),
  ).toString();
}

async function loadPrefill(
  userId: string | null,
  slug: string | undefined,
  journalId: string | undefined,
): Promise<RecentWork | null> {
  // 通知點擊（/say?journal=<id>）優先；找不到紀錄再看 ?work=
  if (userId && journalId) {
    const context = await loadJournalForSay(userId, journalId);
    if (context) return toJournalPrefill(context);
  }
  if (!slug) return null;
  const work = await findWorkBySlug(slug);
  return work ? toPrefilledWork(work) : null;
}

export default async function SayPage({
  searchParams,
}: {
  searchParams: Promise<{
    work?: string | string[];
    journal?: string | string[];
    quote?: string | string[];
    resume?: string | string[];
    mode?: string | string[];
    next?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const userId = await getCurrentUserId();
  const journalId = firstParam(params.journal);
  const resume = firstParam(params.resume) === "1";

  // 先說後登入：未登入也能說；只有帶視聽日誌紀錄（屬於某位使用者）時要先登入
  if (!userId && journalId) {
    redirect(loginRedirectPath("/say", `?${toQueryString(params)}`));
  }

  const [recent, unsaid, prefill] = await Promise.all([
    userId ? loadRecentEpisodeCards(userId) : Promise.resolve([]),
    userId ? loadLatestUnsaid(userId) : Promise.resolve(null),
    loadPrefill(userId, firstParam(params.work), journalId),
  ]);
  const works = buildSayCards({ prefill, unsaid, recent });
  return (
    <SayStage
      works={works}
      initialQuote={normalizeQuoteParam(params.quote)}
      initialMode={firstParam(params.mode) === "text" ? "text" : "voice"}
      signedIn={Boolean(userId)}
      resume={Boolean(userId) && resume}
      destination={firstParam(params.next) === "watched" ? "watched" : "proof"}
    />
  );
}
