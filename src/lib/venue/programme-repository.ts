/**
 * 場刊頁資料（server only，service role）：場外作品底下已發佈、公開的感受，
 * 附上各自連到的日誌「看完」時刻（分晚用）與作者筆名／印文。
 * 匿名署名的感受仍列在感受列表，但不帶筆名、不露印章、不進「這場散場的人」。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { loadPenNames } from "@/lib/me/pen-name";
import { displayAuthor, parseByline } from "@/lib/proof/publish";
import { loadSealGlyphs } from "@/lib/seal/glyph-repository";
import { deriveLede, extractPullQuote, parseArticle } from "@/lib/share/article";
import type { ProgrammeWork } from "./programme";
import type { ProgrammeFeeling } from "./programme-groups";

const FEELING_LIMIT = 200;

interface EpisodeRow {
  id: string;
  title: string;
  share_slug: string;
  created_at: string;
  published_at: string;
  pull_quote: string | null;
  byline: string;
  user_id: string;
  source: string;
  contents: Array<{ platform: string; body: string }> | null;
}

interface JournalRow {
  episode_id: string;
  user_id: string;
  experienced_at: string;
}

async function loadEpisodes(workId: string): Promise<EpisodeRow[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, title, share_slug, created_at, published_at, pull_quote, byline, user_id, source, contents(platform, body)")
    .eq("work_id", workId)
    .eq("visibility", "public")
    .not("share_slug", "is", null)
    .not("published_at", "is", null)
    .neq("source", "rss")
    .order("published_at", { ascending: false })
    .limit(FEELING_LIMIT);
  if (error) {
    console.error("[venue] loadEpisodes failed", { workId, message: error.message });
    return [];
  }
  return (data ?? []) as EpisodeRow[];
}

/** episode → 看完時刻；只認作者本人的日誌列（user_id 一致） */
async function loadExperiencedAt(rows: readonly EpisodeRow[]): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("episode_id, user_id, experienced_at")
    .in("episode_id", rows.map((row) => row.id))
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[venue] loadExperiencedAt failed", { message: error.message });
    return new Map();
  }
  const owner = new Map(rows.map((row) => [row.id, row.user_id]));
  const result = new Map<string, string>();
  for (const row of (data ?? []) as JournalRow[]) {
    if (owner.get(row.episode_id) === row.user_id && !result.has(row.episode_id)) {
      result.set(row.episode_id, row.experienced_at);
    }
  }
  return result;
}

export async function listProgrammeFeelings(workId: string): Promise<ProgrammeFeeling[]> {
  const rows = await loadEpisodes(workId);
  const userIds = rows.map((row) => row.user_id);
  const [penNames, glyphs, experienced] = await Promise.all([
    loadPenNames(userIds),
    loadSealGlyphs(userIds),
    loadExperiencedAt(rows),
  ]);
  return rows.flatMap((row) => {
    const body = row.contents?.find((content) => content.platform === "blog")?.body;
    if (!body) return [];
    const parsed = parseArticle(body);
    const { blocks } = deriveLede(parsed.blocks);
    const byline = parseByline(row.byline) ?? "pen_name";
    const penName = penNames.get(row.user_id) ?? "";
    const signed = byline === "pen_name" && penName.trim() !== "";
    return [
      {
        episodeId: row.id,
        shareSlug: row.share_slug,
        title: parsed.title ?? row.title,
        pullQuote: row.pull_quote ?? extractPullQuote(blocks),
        author: displayAuthor(byline, penName),
        penName: signed ? penName : null,
        glyph: signed ? (glyphs.get(row.user_id) ?? null) : null,
        createdAt: row.created_at,
        publishedAt: row.published_at,
        experiencedAt: experienced.get(row.id) ?? null,
        typed: row.source === "text",
      },
    ];
  });
}

const PROGRAMME_COLUMNS = "id, kind, title, slug, issue_no, venue, event_date, event_end_date, poster_url";

/** 場刊頁用的作品列（含 022 的 event_end_date）；不是場外作品回 null */
export async function loadProgrammeWork(workId: string): Promise<ProgrammeWork | null> {
  const { data, error } = await createAdminClient()
    .from("works")
    .select(PROGRAMME_COLUMNS)
    .eq("id", workId)
    .maybeSingle();
  if (error) {
    console.error("[venue] loadProgrammeWork failed", { workId, message: error.message });
    return null;
  }
  const row = data as ProgrammeWork | null;
  return row && (row.kind === "live" || row.kind === "exhibition") ? row : null;
}
