/** 匯出我的全部文章：只讀自己的集數（有正文的才算文章），附當時說的逐字稿 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ExportArticle } from "./export";

const EXPORT_LIMIT = 1000;

interface ExportRow {
  title: string;
  created_at: string;
  published_at: string | null;
  visibility: string;
  work: { title: string } | null;
  contents: Array<{ platform: string; body: string }>;
  transcripts: Array<{ full_text: string; created_at: string }>;
}

export async function countExportableArticles(userId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("contents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("platform", "blog");
  if (error) throw new Error(`讀取文章數失敗：${error.message}`);
  return count ?? 0;
}

export async function loadExportArticles(userId: string): Promise<ExportArticle[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select(
      "title, created_at, published_at, visibility, work:works(title), contents(platform, body), transcripts(full_text, created_at)",
    )
    .eq("user_id", userId)
    .neq("source", "rss")
    .order("created_at", { ascending: true })
    .limit(EXPORT_LIMIT);
  if (error) throw new Error(`讀取文章失敗：${error.message}`);
  return ((data ?? []) as unknown as ExportRow[]).flatMap((row) => {
    const blog = row.contents.find((content) => content.platform === "blog");
    if (!blog) return [];
    const transcript = [...row.transcripts].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return [
      {
        title: row.title,
        createdAt: row.created_at,
        publishedAt: row.published_at,
        visibility: row.visibility,
        workTitle: row.work?.title ?? null,
        body: blog.body,
        transcript: transcript?.full_text ?? null,
      },
    ];
  });
}
