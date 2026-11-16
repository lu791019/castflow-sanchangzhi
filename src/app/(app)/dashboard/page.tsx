import { requirePageUserId } from "@/lib/auth/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SPECS } from "@/lib/prompts/generate-content";
import { Platform } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const userId = await requirePageUserId("/dashboard");
  const supabase = createAdminClient();

  const [episodesRes, scheduledRes, publishedRes, recentContentsRes] =
    await Promise.all([
      supabase
        .from("episodes")
        .select("id, title, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("contents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "scheduled"),
      supabase
        .from("contents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "published"),
      supabase
        .from("contents")
        .select("id, episode_id, platform, status, scheduled_at, episodes(title)")
        .eq("user_id", userId)
        .in("status", ["scheduled", "published"])
        .order("scheduled_at", { ascending: true })
        .limit(5),
    ]);

  const episodes = episodesRes.data ?? [];
  const scheduledCount = scheduledRes.count ?? 0;
  const publishedCount = publishedRes.count ?? 0;
  const recentContents = recentContentsRes.data ?? [];

  const statusLabels: Record<string, string> = {
    uploaded: "已上傳",
    transcribing: "轉錄中",
    transcribed: "已轉錄",
    error: "錯誤",
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="CastFlow · 工作檯"
        title="Dashboard"
        description="從 Podcast 音訊到社群上架的 AI 內容管線"
      />

      {/* Stats：雜誌資訊欄式統計，墨色頂規線 + 明體數字 */}
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { label: "總集數", value: episodes.length },
          { label: "待發布", value: scheduledCount },
          { label: "已發布", value: publishedCount },
        ].map((stat) => (
          <div key={stat.label} className="border-t-2 border-ink-950 pt-3">
            <h3 className="m-0 text-eyebrow font-bold tracking-[0.2em] text-ink-600">
              {stat.label}
            </h3>
            <p className="mt-2 mb-0 font-serif-tc text-[32px] leading-none font-bold text-ink-950 tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Episodes */}
        <section>
          <SectionHeading
            title="最近集數"
            aside={
              <Link href="/episodes/new">
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  上傳
                </Button>
              </Link>
            }
          />
          <div className="flex flex-col">
            {episodes.length > 0 ? (
              episodes.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/episodes/${ep.id}`}
                  className="flex items-center justify-between gap-3 border-b border-ink-200 py-3 transition-colors hover:bg-paper-2"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium text-ink-950">
                      {ep.title}
                    </p>
                    <p className="mt-0.5 mb-0 text-caption text-ink-600 tabular-nums">
                      {new Date(ep.created_at).toLocaleDateString("zh-TW")}
                    </p>
                  </div>
                  <span className="flex-none text-caption text-ink-600">
                    {statusLabels[ep.status] ?? ep.status}
                  </span>
                </Link>
              ))
            ) : (
              <p className="mt-3 text-sm text-ink-600">
                尚無集數，點擊上傳開始。
              </p>
            )}
          </div>
        </section>

        {/* Upcoming Schedule */}
        <section>
          <SectionHeading
            title="排程 / 近期發布"
            aside={
              <Link href="/schedule">
                <Button variant="outline" size="sm">查看全部</Button>
              </Link>
            }
          />
          <div className="flex flex-col">
            {recentContents.length > 0 ? (
              recentContents.map((item) => {
                const platform = item.platform as Platform;
                const spec = PLATFORM_SPECS[platform];
                const ep = item.episodes as unknown as { title: string } | null;
                const episodeTitle = ep?.title ?? "";
                return (
                  <Link
                    key={item.id}
                    href={`/episodes/${item.episode_id}/edit`}
                    className="flex items-center gap-3 border-b border-ink-200 py-3 transition-colors hover:bg-paper-2"
                  >
                    <span className="w-20 flex-none text-caption font-medium text-ink-700">
                      {spec?.name ?? platform}
                    </span>
                    <span className="flex-1 truncate text-sm text-ink-950">
                      {episodeTitle}
                    </span>
                    <span
                      className={`flex-none text-caption font-bold ${item.status === "published" ? "text-ember-dark" : "text-ink-600"}`}
                    >
                      {item.status === "published" ? "已發布" : "已排程"}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="mt-3 text-sm text-ink-600">
                尚無排程或發布紀錄。
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
