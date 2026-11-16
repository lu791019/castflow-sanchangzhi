/**
 * 索引資料存取（server only，走 service role）。只讀公開內容：
 * - 感受（作品段數）：已發佈、公開、有 share_slug、非 RSS 素材（同作品特輯的慣例，匿名也算一段）
 * - 署名文章（作者、欄目、文章搜尋）：上面再加「以筆名署名」且作者在 profiles 有筆名
 * 搜尋用 ilike（見 search.ts likePattern）；本地沒有 pg_trgm，且兩字中文查詢用不上 trigram 索引。
 */

import { resolveColumnName } from "@/lib/me/column-name";
import { loadColumnNamesByPenNames } from "@/lib/me/column-name-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseArticle } from "@/lib/share/article";
import { assignColumns, type ColumnKey } from "./columns";
import type { PublicFeeling, SignedArticle } from "./results";
import { likePattern } from "./search";
import type { CatalogWork } from "./shelves";

const FEELING_LIMIT = 2000;
const SEARCH_HIT_LIMIT = 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CatalogData {
  works: CatalogWork[];
  feelings: PublicFeeling[];
  signed: SignedArticle[];
  columns: Map<string, ColumnKey>;
  /** 筆名 → 專欄名；只收有公開署名文章、且取了專欄名的作者 */
  columnNames: Map<string, string>;
}

interface EpisodeRow {
  id: string;
  user_id: string;
  byline: string;
  work_id: string | null;
  published_at: string;
  share_slug: string;
}

interface WorkRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  year: number | null;
  podcast_show: string | null;
  poster_url: string | null;
  event_date: string | null;
  issue_no: number;
}

/** 公開範圍的共同條件（作品特輯 listWorkFeelings 同一套） */
function publicEpisodes(columns: string) {
  return createAdminClient()
    .from("episodes")
    .select(columns)
    .eq("visibility", "public")
    .not("share_slug", "is", null)
    .not("published_at", "is", null)
    .neq("source", "rss");
}

async function loadPublicEpisodes(): Promise<EpisodeRow[]> {
  const { data, error } = await publicEpisodes("id, user_id, byline, work_id, published_at, share_slug")
    .order("published_at", { ascending: false })
    .limit(FEELING_LIMIT);
  if (error) throw new Error(`讀取公開文章失敗：${error.message}`);
  return ((data ?? []) as unknown as EpisodeRow[]).map((row) => ({
    ...row,
    published_at: new Date(row.published_at).toISOString(),
  }));
}

/** user_id → 筆名；只認 profiles 真的取了筆名的人（不用單人時期的 fallback） */
async function loadProfilePenNames(userIds: readonly string[]): Promise<Map<string, string>> {
  const uuids = [...new Set(userIds)].filter((id) => UUID_PATTERN.test(id));
  if (uuids.length === 0) return new Map();
  const { data, error } = await createAdminClient().from("profiles").select("id, pen_name").in("id", uuids);
  if (error) throw new Error(`讀取筆名失敗：${error.message}`);
  return new Map(
    ((data ?? []) as Array<{ id: string; pen_name: string | null }>).flatMap((row) =>
      row.pen_name ? [[row.id, row.pen_name] as const] : [],
    ),
  );
}

async function loadWorks(ids: readonly string[]): Promise<CatalogWork[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("works")
    .select("id, slug, kind, title, year, podcast_show, poster_url, event_date, issue_no")
    .in("id", [...new Set(ids)]);
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  return ((data ?? []) as WorkRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    year: row.year,
    podcastShow: row.podcast_show,
    posterUrl: row.poster_url,
    eventDate: row.event_date,
    issueNo: row.issue_no,
  }));
}

/** 索引需要的全部公開資料（作品、段數、署名文章、欄目歸屬） */
export async function loadCatalogData(): Promise<CatalogData> {
  const episodes = await loadPublicEpisodes();
  const [penNames, works] = await Promise.all([
    loadProfilePenNames(episodes.map((row) => row.user_id)),
    loadWorks(episodes.flatMap((row) => (row.work_id ? [row.work_id] : []))),
  ]);
  const kindOf = new Map(works.map((work) => [work.id, work.kind]));
  const feelings = episodes.flatMap((row) =>
    row.work_id ? [{ workId: row.work_id, userId: row.user_id, publishedAt: row.published_at }] : [],
  );
  const signed = episodes.flatMap((row) => {
    const penName = penNames.get(row.user_id);
    if (row.byline !== "pen_name" || !penName) return [];
    return [
      {
        id: row.id,
        userId: row.user_id,
        penName,
        workId: row.work_id,
        workKind: row.work_id ? (kindOf.get(row.work_id) ?? null) : null,
        publishedAt: row.published_at,
        shareSlug: row.share_slug,
      },
    ];
  });
  const columnNames = await loadColumnNamesByPenNames(signed.map((article) => article.penName));
  return { works, feelings, signed, columns: assignColumns(signed), columnNames };
}

export interface ArticleText {
  title: string;
  body: string;
  pullQuote: string | null;
}

/** 指定文章的正文與標題（標題以正文 # 行為準，和目錄、分享頁一致） */
export async function loadArticleTexts(ids: readonly string[]): Promise<Map<string, ArticleText>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, title, pull_quote, contents(platform, body)")
    .in("id", [...new Set(ids)]);
  if (error) throw new Error(`讀取文章失敗：${error.message}`);
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    pull_quote: string | null;
    contents: Array<{ platform: string; body: string }> | null;
  }>;
  return new Map(
    rows.flatMap((row) => {
      const body = row.contents?.find((content) => content.platform === "blog")?.body;
      if (!body) return [];
      return [[row.id, { title: parseArticle(body).title ?? row.title, body, pullQuote: row.pull_quote }] as const];
    }),
  );
}

/** 文章搜尋：正文（含 # 標題行）或 episodes.title 命中；結果再由呼叫端限縮到署名文章 */
export async function searchArticleIds(query: string): Promise<string[]> {
  const pattern = likePattern(query);
  const supabase = createAdminClient();
  const [bodyHits, titleHits] = await Promise.all([
    supabase
      .from("contents")
      .select("episode_id, episodes!inner(id)")
      .eq("platform", "blog")
      .ilike("body", pattern)
      .eq("episodes.visibility", "public")
      .eq("episodes.byline", "pen_name")
      .not("episodes.published_at", "is", null)
      .limit(SEARCH_HIT_LIMIT),
    publicEpisodes("id").eq("byline", "pen_name").ilike("title", pattern).limit(SEARCH_HIT_LIMIT),
  ]);
  if (bodyHits.error) throw new Error(`搜尋正文失敗：${bodyHits.error.message}`);
  if (titleHits.error) throw new Error(`搜尋標題失敗：${titleHits.error.message}`);
  const ids = [
    ...((bodyHits.data ?? []) as Array<{ episode_id: string }>).map((row) => row.episode_id),
    ...((titleHits.data ?? []) as unknown as Array<{ id: string }>).map((row) => row.id),
  ];
  return [...new Set(ids)];
}

export interface AuthorColumnData {
  penName: string;
  columnName: string | null;
  articles: SignedArticle[];
  works: CatalogWork[];
  columns: Map<string, ColumnKey>;
}

/**
 * 作者專欄頁：筆名 → 該作者「公開發佈＋筆名署名」的文章。
 * 筆名不存在或沒有任何公開署名文章都回 null（頁面 404，不洩漏帳號是否存在）。
 * 欄目歸屬只看同一作者自己的文章就能判斷重看，結果與索引一致。
 */
export async function loadAuthorColumn(penName: string): Promise<AuthorColumnData | null> {
  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .select("id, pen_name, column_name")
    .eq("pen_name", penName)
    .maybeSingle();
  if (error) throw new Error(`讀取筆名失敗：${error.message}`);
  if (!profile?.pen_name) return null;

  const { data, error: episodesError } = await publicEpisodes("id, user_id, byline, work_id, published_at, share_slug")
    .eq("user_id", profile.id)
    .eq("byline", "pen_name")
    .order("published_at", { ascending: false })
    .limit(FEELING_LIMIT);
  if (episodesError) throw new Error(`讀取作者文章失敗：${episodesError.message}`);
  const rows = (data ?? []) as unknown as EpisodeRow[];
  if (rows.length === 0) return null;

  const works = await loadWorks(rows.flatMap((row) => (row.work_id ? [row.work_id] : [])));
  const kindOf = new Map(works.map((work) => [work.id, work.kind]));
  const articles = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    penName: profile.pen_name as string,
    workId: row.work_id,
    workKind: row.work_id ? (kindOf.get(row.work_id) ?? null) : null,
    publishedAt: new Date(row.published_at).toISOString(),
    shareSlug: row.share_slug,
  }));
  return {
    penName: profile.pen_name as string,
    columnName: resolveColumnName(profile.column_name as string | null),
    articles,
    works,
    columns: assignColumns(articles),
  };
}
