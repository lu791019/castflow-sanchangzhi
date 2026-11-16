import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canWriteLongform } from "@castflow/engine/generate/watched";
import { requirePageUserId } from "@/lib/auth/page";
import { siteOriginString } from "@/lib/seo/site";
import { workPageUrl } from "@/lib/watched/post";
import { loadWatchedData } from "@/lib/watched/repository";
import { loadThreadsDirectConfig } from "@/lib/watched/threads-direct";
import { TranscribeFailed, Transcribing } from "../../../proof/[episodeId]/proof-transcribe";
import { WatchedResult } from "./watched-result";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "看完了｜散場誌",
  robots: { index: false },
};

export default async function WatchedResultPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  const userId = await requirePageUserId(`/watched/${episodeId}`);
  const data = await loadWatchedData(episodeId, userId);
  if (!data) notFound();
  const { episode, work, transcript } = data.proof;
  const meta = work ? `《${work.title}》` : episode.title;

  if (!transcript) {
    return episode.status === "error" ? (
      <TranscribeFailed meta={`${meta} 錄的`} audioUrl={episode.audioUrl} />
    ) : (
      <Transcribing meta={meta} audioUrl={episode.audioUrl} createdAt={episode.createdAt} />
    );
  }

  const canPostDirect = await loadThreadsDirectConfig(userId)
    .then(Boolean)
    .catch(() => false);
  return (
    <WatchedResult
      canPostDirect={canPostDirect}
      episodeId={episode.id}
      workTitle={work?.title ?? null}
      rating={data.rating}
      link={work ? workPageUrl(siteOriginString(), work.slug) : null}
      initialPost={data.post}
      initialLongform={data.longform}
      longformAvailable={canWriteLongform(transcript.text)}
    />
  );
}
