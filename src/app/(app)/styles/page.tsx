import { requirePageUserId } from "@/lib/auth/page";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";

export default async function StylesPage() {
  const userId = await requirePageUserId("/styles");
  const supabase = createAdminClient();
  const { data: styles } = await supabase
    .from("style_dnas")
    .select("*")
    .eq("user_id", userId)
    .order("extracted_at", { ascending: false });

  return (
    <div>
      <PageHeader
        eyebrow="CastFlow · 風格"
        title="Styles"
        description="管理你的風格 DNA"
        actions={
          <Link href="/styles/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              建立新風格
            </Button>
          </Link>
        }
      />

      <div className="mt-2 flex flex-col">
        {styles && styles.length > 0 ? (
          styles.map((style) => (
            <Link
              key={style.id}
              href={`/styles/${style.id}`}
              className="block border-b border-ink-200 py-4 transition-colors hover:bg-paper-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="m-0 truncate font-serif-tc text-[17px] font-bold text-ink-950">
                    {style.name}
                  </h3>
                  <p className="mt-1 mb-0 text-caption text-ink-600">
                    {style.platform} · {style.source_example_count} 篇範例 ·{" "}
                    {new Date(style.extracted_at).toLocaleDateString("zh-TW")}
                  </p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className="mt-4 text-ink-600">
            尚無風格 DNA。點擊「建立新風格」開始提取。
          </p>
        )}
      </div>
    </div>
  );
}
