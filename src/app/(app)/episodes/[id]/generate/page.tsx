import { notFound } from "next/navigation";
import { requirePageUserId } from "@/lib/auth/page";
import { loadEpisodeGenerateData } from "@/lib/auth/owned-reads";
import { createAdminClient } from "@/lib/supabase/admin";
import { GenerateView } from "./generate-view";

export default async function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requirePageUserId(`/episodes/${id}/generate`);

  // 不是自己的集數 → 404（不透露是否存在）
  const data = await loadEpisodeGenerateData(createAdminClient(), userId, id);
  if (!data) notFound();

  return (
    <GenerateView
      episodeId={data.episode.id}
      episodeTitle={data.episode.title}
      transcriptPreview={data.transcriptPreview}
      hasContent={data.hasContent}
    />
  );
}
