import { requirePageUserId } from "@/lib/auth/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { TranscriptViewer } from "@/components/episodes/transcript-viewer";
import { TranscriptionTrigger } from "@/components/episodes/transcription-trigger";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requirePageUserId(`/episodes/${id}`);
  const supabase = createAdminClient();

  // 不是自己的集數 → 404
  const { data: episode } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!episode) notFound();

  const [{ data: transcript }, { count: contentCount }] = await Promise.all([
    supabase
      .from("transcripts")
      .select("*")
      .eq("episode_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("contents")
      .select("*", { count: "exact", head: true })
      .eq("episode_id", id),
  ]);

  const statusLabels: Record<string, string> = {
    uploaded: "已上傳",
    transcribing: "轉錄中...",
    transcribed: "已轉錄",
    error: "轉錄失敗",
  };

  return (
    <div>
      <PageHeader
        eyebrow="CastFlow · 集數"
        title={episode.title}
        description={`狀態：${statusLabels[episode.status] ?? episode.status}${
          episode.duration_seconds
            ? ` · ${Math.round(episode.duration_seconds / 60)} 分鐘`
            : ""
        }`}
        actions={
          <>
            {episode.status === "transcribed" && (
              <Link href={`/episodes/${id}/generate`}>
                <Button>生成文案</Button>
              </Link>
            )}
            {(contentCount ?? 0) > 0 && (
              <Link href={`/episodes/${id}/edit`}>
                <Button variant="outline">編輯文案 ({contentCount ?? 0})</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mt-8">
        <SectionHeading title="逐字稿" />
        <div className="mt-4">
        {transcript ? (
          <TranscriptViewer segments={transcript.segments ?? []} />
        ) : (
          <TranscriptionTrigger episodeId={episode.id} status={episode.status} />
        )}
        </div>
      </div>
    </div>
  );
}
