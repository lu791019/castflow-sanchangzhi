import { requirePageUserId } from "@/lib/auth/page";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";

export default async function EpisodesPage() {
  const userId = await requirePageUserId("/episodes");
  const supabase = createAdminClient();
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const statusLabels: Record<string, string> = {
    uploaded: "已上傳",
    transcribing: "轉錄中",
    transcribed: "已轉錄",
    error: "錯誤",
  };

  return (
    <div>
      <PageHeader
        eyebrow="CastFlow · 集數"
        title="Episodes"
        description="每一集的音訊、逐字稿與文案都從這裡開始"
        actions={
          <Link href="/episodes/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              上傳新集數
            </Button>
          </Link>
        }
      />

      <div className="mt-2 flex flex-col">
        {episodes && episodes.length > 0 ? (
          episodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/episodes/${ep.id}`}
              className="block border-b border-ink-200 py-4 transition-colors hover:bg-paper-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="m-0 truncate font-serif-tc text-[17px] font-bold text-ink-950">
                    {ep.title}
                  </h3>
                  <p className="mt-1 mb-0 text-caption text-ink-600 tabular-nums">
                    {new Date(ep.created_at).toLocaleDateString("zh-TW")}
                  </p>
                </div>
                <span className="flex-none text-note text-ink-600">
                  {statusLabels[ep.status] ?? ep.status}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <p className="mt-4 text-ink-600">尚無集數，點擊「上傳新集數」開始。</p>
        )}
      </div>
    </div>
  );
}
