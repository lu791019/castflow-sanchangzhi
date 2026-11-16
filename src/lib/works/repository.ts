/** 作品資料存取（server only，走 service role；只回傳公開欄位） */

import { createAdminClient } from "@/lib/supabase/admin";
import { loadPenNames } from "@/lib/me/pen-name";
import { displayAuthor, parseByline } from "@/lib/proof/publish";
import { extractPullQuote, parseArticle, deriveLede } from "@/lib/share/article";
import { WORK_COLUMNS, WORK_SLUG_PATTERN, type Work } from "./format";

export interface WorkFeeling {
  episodeId: string;
  shareSlug: string;
  title: string;
  pullQuote: string | null;
  author: string;
  publishedAt: string;
}

export interface WorkIndexItem {
  slug: string;
  title: string;
  kind: Work["kind"];
  issueNo: number;
  podcastShow: string | null;
}

export async function findWorkBySlug(slug: string): Promise<Work | null> {
  if (!WORK_SLUG_PATTERN.test(slug)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[works] findWorkBySlug failed", { slug, message: error.message });
    return null;
  }
  return (data as Work | null) ?? null;
}

export async function findWorkById(id: string): Promise<Work | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[works] findWorkById failed", { id, message: error.message });
    return null;
  }
  return (data as Work | null) ?? null;
}

export async function listWorks(limit = 100): Promise<WorkIndexItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("works")
    .select("slug, title, kind, issue_no, podcast_show")
    .order("issue_no", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (error) console.error("[works] listWorks failed", { message: error.message });
    return [];
  }
  return data.map((row) => ({
    slug: row.slug,
    title: row.title,
    kind: row.kind as Work["kind"],
    issueNo: row.issue_no,
    podcastShow: row.podcast_show,
  }));
}

interface FeelingRow {
  id: string;
  title: string;
  share_slug: string;
  created_at: string;
  published_at: string | null;
  pull_quote: string | null;
  byline: string;
  user_id: string;
  contents: Array<{ platform: string; body: string }> | null;
}

/**
 * 作品底下的「感受」：已發佈且公開範圍為「公開」（有 share_slug）、非 RSS 原始來源、且有 blog 正文的集數。
 * RSS 集數是作品本身的素材，不算聽眾留下的感受；「只給有連結的人」與「私人」不進特輯。依發表時間新 → 舊。
 * 共鳴句：作者在校樣選定的引言優先，沒選才自動抽句。
 */
export async function listWorkFeelings(workId: string): Promise<WorkFeeling[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
      .from("episodes")
      .select(
        "id, title, share_slug, created_at, published_at, pull_quote, byline, user_id, contents(platform, body)",
      )
      .eq("work_id", workId)
      .eq("visibility", "public")
      .not("share_slug", "is", null)
      .not("published_at", "is", null)
      .neq("source", "rss")
      .order("published_at", { ascending: false })
      .limit(200);
  if (error || !data) {
    if (error) console.error("[works] listWorkFeelings failed", { workId, message: error.message });
    return [];
  }
  const rows = data as FeelingRow[];
  // 每段感受署名各自作者的筆名
  const penNames = await loadPenNames(rows.map((row) => row.user_id));
  return rows.flatMap((row) => {
    const body = row.contents?.find((content) => content.platform === "blog")?.body;
    if (!body) return [];
    const parsed = parseArticle(body);
    const { blocks } = deriveLede(parsed.blocks);
    return [
      {
        episodeId: row.id,
        shareSlug: row.share_slug,
        title: parsed.title ?? row.title,
        pullQuote: row.pull_quote ?? extractPullQuote(blocks),
        author: displayAuthor(parseByline(row.byline) ?? "pen_name", penNames.get(row.user_id) ?? ""),
        publishedAt: row.published_at ?? row.created_at,
      },
    ];
  });
}
