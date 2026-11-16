/**
 * 作品特輯改版資料（server only，service role）：感受列表（含印章署名與時間差）、
 * 「這週散場的人」、由共鳴資料產生的「大家最有共鳴的一句」與來源名單。
 * 社群呈現（印章、同場、共鳴句、來源名單）只取「以筆名署名＋公開發佈」；匿名署名的文章仍計入段數與列表，但不露印章。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { episodeTimeLabel, toEpisodeJournal, type EpisodeJournalRow } from "@/lib/journal/episode-byline";
import { ANONYMOUS_NAME, parseByline } from "@/lib/proof/publish";
import { deriveLede, extractPullQuote, parseArticle } from "@/lib/share/article";
import {
  layoutFeatureResonance,
  pickCast,
  rankFeatureQuotes,
  resonanceSource,
  type CastMember,
  type FeatureQuoteCandidate,
  type FeatureResonanceLayout,
  type ResonanceSource,
} from "./feature";
import { listPassages, type Passage } from "./passage";
import { loadProfilePenNames, loadPublicAuthorNames } from "./public-authors";
import { thisWeekStart } from "./week";

const FEELING_LIMIT = 200;
const MARK_LIMIT = 5000;
const CAST_LIMIT = 50;

export interface FeatureFeeling {
  episodeId: string;
  userId: string;
  shareSlug: string;
  title: string;
  /** 有筆名＝可露印章、連專欄；匿名署名或沒有筆名為 null */
  penName: string | null;
  author: string;
  publishedAt: string;
  saidAt: string;
  /** 「10.07 晚上看完・隔天說的」；沒有連結日誌時退回錄下時刻 */
  signature: string;
  excerpt: string | null;
  pullQuote: string | null;
  passages: Passage[];
}

export interface FeatureData {
  feelings: FeatureFeeling[];
  cast: CastMember[];
  resonance: FeatureResonanceLayout;
  /** 第一句的「誰也這樣想」；沒有共鳴為 null */
  source: ResonanceSource | null;
  weekStart: Date;
}

interface FeelingRow {
  id: string;
  title: string;
  share_slug: string;
  source: string;
  created_at: string;
  published_at: string | null;
  pull_quote: string | null;
  byline: string;
  user_id: string;
  contents: Array<{ platform: string; body: string }> | null;
}

async function loadFeelingRows(workId: string): Promise<FeelingRow[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, title, share_slug, source, created_at, published_at, pull_quote, byline, user_id, contents(platform, body)")
    .eq("work_id", workId)
    .eq("visibility", "public")
    .not("share_slug", "is", null)
    .not("published_at", "is", null)
    .neq("source", "rss")
    .order("published_at", { ascending: false })
    .limit(FEELING_LIMIT);
  if (error) {
    console.error("[resonance] loadFeelingRows failed", { workId, message: error.message });
    return [];
  }
  return (data ?? []) as FeelingRow[];
}

type JournalRow = EpisodeJournalRow & { episode_id: string; created_at: string };

async function loadJournals(episodeIds: string[]): Promise<Map<string, JournalRow>> {
  const result = new Map<string, JournalRow>();
  if (episodeIds.length === 0) return result;
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("id, experienced_at, venue, episode_id, created_at, works(kind)")
    .in("episode_id", episodeIds)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[resonance] loadJournals failed", { message: error.message });
    return result;
  }
  // 多筆取最新（依 created_at 升冪，後寫覆蓋前寫）
  for (const row of (data ?? []) as JournalRow[]) result.set(row.episode_id, row);
  return result;
}

function toFeeling(row: FeelingRow, penNames: Map<string, string>, journals: Map<string, JournalRow>): FeatureFeeling | null {
  const body = row.contents?.find((content) => content.platform === "blog")?.body;
  if (!body) return null;
  const parsed = parseArticle(body);
  const { lede, blocks } = deriveLede(parsed.blocks);
  const anonymous = parseByline(row.byline) === "anonymous";
  const penName = anonymous ? null : (penNames.get(row.user_id) ?? null);
  const firstParagraph = blocks.find((block) => block.type === "paragraph");
  return {
    episodeId: row.id,
    userId: row.user_id,
    shareSlug: row.share_slug,
    title: parsed.title ?? row.title,
    penName,
    author: penName ?? ANONYMOUS_NAME,
    publishedAt: row.published_at ?? row.created_at,
    saidAt: row.created_at,
    signature: episodeTimeLabel({
      createdAt: row.created_at,
      source: row.source,
      journal: toEpisodeJournal(journals.get(row.id)),
    }),
    excerpt: lede ?? (firstParagraph?.type === "paragraph" ? firstParagraph.text : null),
    pullQuote: row.pull_quote ?? extractPullQuote(blocks),
    passages: listPassages(blocks),
  };
}

interface MarkRow {
  episode_id: string;
  passage_hash: string;
  user_id: string;
  created_at: string;
}

async function loadMarks(episodeIds: string[]): Promise<MarkRow[]> {
  if (episodeIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("passage_resonances")
    .select("episode_id, passage_hash, user_id, created_at")
    .in("episode_id", episodeIds)
    .order("created_at", { ascending: false })
    .limit(MARK_LIMIT);
  if (error) {
    console.error("[resonance] loadMarks failed", { message: error.message });
    return [];
  }
  return (data ?? []) as MarkRow[];
}

interface ResonatedPassage extends FeatureQuoteCandidate {
  hash: string;
  /** 新 → 舊 */
  markerIds: string[];
}

/** 記號依（文章, 段）分組；只留現行正文對得上的段 */
function groupResonated(marks: MarkRow[], feelings: FeatureFeeling[]): ResonatedPassage[] {
  const byEpisode = new Map(feelings.map((feeling) => [feeling.episodeId, feeling]));
  const groups = new Map<string, ResonatedPassage>();
  for (const mark of marks) {
    const feeling = byEpisode.get(mark.episode_id);
    const passage = feeling?.passages.find((item) => item.hash === mark.passage_hash);
    if (!feeling?.penName || !passage) continue;
    const key = `${mark.episode_id}:${mark.passage_hash}`;
    const previous = groups.get(key);
    groups.set(key, {
      episodeId: feeling.episodeId,
      author: feeling.penName,
      text: passage.text,
      publishedAt: feeling.publishedAt,
      hash: passage.hash,
      count: (previous?.count ?? 0) + 1,
      markerIds: [...(previous?.markerIds ?? []), mark.user_id],
    });
  }
  return [...groups.values()];
}

async function sourceFor(top: FeatureQuoteCandidate | undefined, resonated: ResonatedPassage[], feelings: FeatureFeeling[]) {
  if (!top || top.count === 0) return null;
  const passage = resonated.find((item) => item.episodeId === top.episodeId && item.text === top.text);
  if (!passage) return null;
  const authorId = feelings.find((feeling) => feeling.episodeId === top.episodeId)?.userId;
  const markerIds = passage.markerIds.filter((id) => id !== authorId);
  const publicNames = await loadPublicAuthorNames(markerIds);
  const named = markerIds.flatMap((id) => {
    const name = publicNames.get(id);
    return name ? [name] : [];
  });
  return resonanceSource(passage.count, named);
}

/** community=false（社群關閉）：不讀句邊共鳴，「最有共鳴的一句」只用各篇引言 */
export async function loadFeatureData(workId: string, now: Date, community = true): Promise<FeatureData> {
  const rows = await loadFeelingRows(workId);
  const [penNames, journals] = await Promise.all([
    loadProfilePenNames(rows.filter((row) => parseByline(row.byline) !== "anonymous").map((row) => row.user_id)),
    loadJournals(rows.map((row) => row.id)),
  ]);
  const feelings = rows.flatMap((row) => toFeeling(row, penNames, journals) ?? []);
  const named = feelings.filter((feeling) => feeling.penName);
  const weekStart = thisWeekStart(now);

  const marks = community ? await loadMarks(named.map((feeling) => feeling.episodeId)) : [];
  const resonated = groupResonated(marks, named);
  const fallbacks = named.flatMap((feeling) =>
    feeling.pullQuote
      ? [{ episodeId: feeling.episodeId, author: feeling.penName ?? "", text: feeling.pullQuote, count: 0, publishedAt: feeling.publishedAt }]
      : [],
  );
  const ranked = rankFeatureQuotes(resonated, fallbacks);

  const cast = pickCast(
    named.map((feeling) => ({
      userId: feeling.userId,
      penName: feeling.penName,
      saidAt: feeling.saidAt,
      shareSlug: feeling.shareSlug,
      pullQuote: feeling.pullQuote,
    })),
    { since: weekStart, limit: CAST_LIMIT },
  );

  return {
    feelings,
    cast,
    resonance: layoutFeatureResonance(ranked),
    source: await sourceFor(ranked[0], resonated, feelings),
    weekStart,
  };
}
