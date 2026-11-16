import { requirePageUserId } from "@/lib/auth/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SPECS } from "@/lib/prompts/generate-content";
import { Platform } from "@/lib/types";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

export default async function SchedulePage() {
  const userId = await requirePageUserId("/schedule");
  const supabase = createAdminClient();

  const { data: contents } = await supabase
    .from("contents")
    .select("*, episodes(title)")
    .eq("user_id", userId)
    .in("status", ["scheduled", "published", "failed"])
    .order("scheduled_at", { ascending: true });

  // Group by date
  const grouped: Record<string, typeof contents> = {};
  for (const item of contents ?? []) {
    const date = item.scheduled_at
      ? new Date(item.scheduled_at).toLocaleDateString("zh-TW")
      : item.published_at
        ? new Date(item.published_at).toLocaleDateString("zh-TW")
        : "未排程";

    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    scheduled: { label: "已排程", color: "text-ink-600" },
    published: { label: "已發布", color: "text-ember-dark" },
    failed: { label: "失敗", color: "text-destructive" },
  };

  return (
    <div>
      <PageHeader
        eyebrow="CastFlow · 排程"
        title="Schedule"
        description="排程與發布紀錄"
      />

      <div className="mt-6 space-y-8">
        {Object.keys(grouped).length > 0 ? (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h2 className="mb-1 border-b border-ink-950 pb-2 text-eyebrow font-bold tracking-[0.2em] text-ink-950 tabular-nums">
                {date}
              </h2>
              <div className="flex flex-col">
                {items!.map((item) => {
                  const episodeTitle =
                    (item.episodes as { title: string } | null)?.title ?? "未知集數";
                  const platform = item.platform as Platform;
                  const spec = PLATFORM_SPECS[platform];
                  const st = statusLabels[item.status] ?? {
                    label: item.status,
                    color: "text-muted-foreground",
                  };
                  const time = item.scheduled_at
                    ? new Date(item.scheduled_at).toLocaleTimeString("zh-TW", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <Link
                      key={item.id}
                      href={`/episodes/${item.episode_id}/edit`}
                      className="flex items-center gap-4 border-b border-ink-200 py-3 transition-colors hover:bg-paper-2"
                    >
                      <span className="w-12 flex-none text-caption text-ink-600 tabular-nums">
                        {time}
                      </span>
                      <span className="w-24 flex-none text-caption font-medium text-ink-700">
                        {spec?.name ?? platform}
                      </span>
                      <span className="flex-1 truncate text-sm text-ink-950">
                        {episodeTitle}
                      </span>
                      <span className={`flex-none text-caption font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <p className="text-ink-600">
            尚無排程或發布紀錄。
          </p>
        )}
      </div>
    </div>
  );
}
