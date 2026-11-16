import { notFound } from "next/navigation";
import { requirePageUserId } from "@/lib/auth/page";
import { loadEpisodeEditData } from "@/lib/auth/owned-reads";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditView } from "./edit-view";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requirePageUserId(`/episodes/${id}/edit`);

  // 不是自己的集數 → 404（不透露是否存在）
  const data = await loadEpisodeEditData(createAdminClient(), userId, id);
  if (!data) notFound();

  return (
    <EditView
      episodeId={data.episode.id}
      episodeTitle={data.episode.title}
      initialContents={data.contents}
    />
  );
}
