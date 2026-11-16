/**
 * 作品特輯改版（P3 作品特輯 A/B/C）的純邏輯：
 * - 「大家最有共鳴的一句」：依共鳴人數排序（同數依發表時間早 → 晚），每位作者一句，最多三句；
 *   沒有人留記號的作者以文章引言補位，排在有共鳴的後面。
 * - resonance.layout：兩句以上直排、只有一句橫排留「等第二句」、零句稿紙空行。
 * - resonance.source：「阿哲、Kai 和另外 9 人也這樣想」最多點名兩位。
 * - 同場（sameShow / cast.row）與「本週／更早」分段（group.subhead）。
 */

import { normalizeQuote } from "@/lib/works/resonance";
import { formatDayRange, isWithin } from "./week";

export const FEATURE_QUOTES_MAX = 3;
export const VERTICAL_MAX_CHARS = 22;
export const SOURCE_NAMES_MAX = 2;

export interface FeatureQuoteCandidate {
  episodeId: string;
  /** 文章作者筆名（只有以筆名署名、公開發佈的文章才會進來） */
  author: string;
  text: string;
  /** 共鳴人數；引言補位為 0 */
  count: number;
  publishedAt: string;
}

export type FeatureResonanceLayout =
  | { variant: "vertical"; quotes: FeatureQuoteCandidate[] }
  | { variant: "single"; quote: FeatureQuoteCandidate }
  | { variant: "empty" };

function byResonance(a: FeatureQuoteCandidate, b: FeatureQuoteCandidate): number {
  return b.count - a.count || a.publishedAt.localeCompare(b.publishedAt);
}

export function rankFeatureQuotes(
  resonated: readonly FeatureQuoteCandidate[],
  fallbacks: readonly FeatureQuoteCandidate[],
): FeatureQuoteCandidate[] {
  const ordered = [
    ...resonated.filter((item) => item.count > 0).sort(byResonance),
    ...[...fallbacks].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).map((item) => ({ ...item, count: 0 })),
  ];
  const seen = new Set<string>();
  return ordered
    .filter((item) => normalizeQuote(item.text).length > 0)
    .filter((item) => {
      const key = item.author.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, FEATURE_QUOTES_MAX);
}

export function layoutFeatureResonance(quotes: FeatureQuoteCandidate[]): FeatureResonanceLayout {
  if (quotes.length === 0) return { variant: "empty" };
  if (quotes.length === 1) return { variant: "single", quote: quotes[0] };
  return { variant: "vertical", quotes };
}

/** 直排一欄放得下的字：整段 ≤22 字原樣；否則取第一個放得下的句子；都放不下截 21 字加「⋯」 */
export function verticalQuoteText(text: string): string {
  const normalized = normalizeQuote(text);
  const chars = Array.from(normalized);
  if (chars.length <= VERTICAL_MAX_CHARS) return normalized;
  const sentence = normalized
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .find((part) => part.length > 0 && Array.from(part).length <= VERTICAL_MAX_CHARS);
  return sentence ?? `${chars.slice(0, VERTICAL_MAX_CHARS - 1).join("")}⋯`;
}

export interface ResonanceSource {
  names: string[];
  others: number;
}

/** namedMarkers：點得出名字的人（已依新 → 舊排好）；其餘算「另外 N 人」 */
export function resonanceSource(count: number, namedMarkers: readonly string[]): ResonanceSource | null {
  if (count <= 0) return null;
  const names = namedMarkers.slice(0, Math.min(SOURCE_NAMES_MAX, count));
  return { names, others: count - names.length };
}

export interface CastCandidate {
  userId: string;
  /** null＝匿名署名或沒有筆名，不出現在同場 */
  penName: string | null;
  /** 說出來的時間（episode 建立時刻） */
  saidAt: string;
  shareSlug: string;
  pullQuote: string | null;
}

export interface CastMember extends CastCandidate {
  penName: string;
}

interface PickCastOptions {
  since: Date;
  limit: number;
  /** 不列入的人（文章頁排除作者本人） */
  exclude?: string | null;
}

export function pickCast(candidates: readonly CastCandidate[], { since, limit, exclude }: PickCastOptions): CastMember[] {
  const sorted = [...candidates]
    .filter((item): item is CastMember => Boolean(item.penName))
    .filter((item) => item.userId !== exclude && isWithin(item.saidAt, since))
    .sort((a, b) => b.saidAt.localeCompare(a.saidAt));
  const seen = new Set<string>();
  return sorted
    .filter((item) => {
      if (seen.has(item.userId)) return false;
      seen.add(item.userId);
      return true;
    })
    .slice(0, limit);
}

export interface FeelingGroup<T> {
  key: "week" | "earlier";
  label: "本週" | "更早";
  /** 段數：「5 段」 */
  count: string;
  range: string;
  items: T[];
}

const RANGE_SEPARATOR = " – ";

/** feelings 依發表時間新 → 舊；本週＝weekStart 之後 */
export function groupFeelings<T extends { publishedAt: string }>(
  feelings: readonly T[],
  weekStart: Date,
  now: Date,
): FeelingGroup<T>[] {
  const week = feelings.filter((item) => isWithin(item.publishedAt, weekStart));
  const earlier = feelings.filter((item) => !isWithin(item.publishedAt, weekStart));
  const groups: FeelingGroup<T>[] = [];
  if (week.length > 0) {
    groups.push({
      key: "week",
      label: "本週",
      count: `${week.length} 段`,
      range: formatDayRange(weekStart, now, RANGE_SEPARATOR),
      items: week,
    });
  }
  if (earlier.length > 0) {
    const newest = new Date(earlier[0].publishedAt);
    const oldest = new Date(earlier[earlier.length - 1].publishedAt);
    groups.push({
      key: "earlier",
      label: "更早",
      count: `${earlier.length} 段`,
      range: formatDayRange(oldest, newest, RANGE_SEPARATOR),
      items: earlier,
    });
  }
  return groups;
}

const SAME_WORK_NOUN: Record<string, string> = {
  movie: "一部電影",
  series: "一部影集",
  podcast_episode: "一集節目",
  live: "一場演出",
  exhibition: "一檔展覽",
  music: "一張專輯",
};

/** 文章頁同場區的說明：「同一週，同一部電影。點印章，讀他們的專欄。」 */
export function sameShowNote(kind: string): string {
  return `同一週，同${SAME_WORK_NOUN[kind] ?? "一部作品"}。點印章，讀他們的專欄。`;
}
