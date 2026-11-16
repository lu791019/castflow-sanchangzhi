/**
 * 散場之前①「這週上映・開演・開展」卡片組裝（純函式）：
 * 電影正在上映／即將上映、影集本週熱門（既有 trending 快取）＋社群場刊（演出、展覽，今天起 30 天內）
 * ＋文化部藝文活動（演出、展覽，culture-cards.ts）＋Podcast 本週榜單（podcast-cards.ts）＋音樂本週熱門（music-cards.ts）。
 * 各組先去重再輪流排，讓第一屏就看得到不同種類。
 */

import type { EventSource } from "@/lib/events/collected";
import type { SourcedEvents } from "@/lib/events/select";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import type { MediaKey, TasteProfile } from "@/lib/taste/types";
import type { MusicAlbumResult, PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { cultureCard, dropCommunityDuplicates } from "./culture-cards";
import { fullDate, LIVE_DEFAULT_TIME, shortDate } from "./format";
import { musicCards } from "./music-cards";
import { podcastCards } from "./podcast-cards";

export const LIVE_WINDOW_DAYS = 30;

/** 各組上限：正在上映 4、即將上映 4、影集 2、社群場外 6、Podcast 6、音樂 6（文化部的上限在 events/culture.ts） */
export const CARD_LIMITS = { nowPlaying: 4, upcoming: 4, series: 2, live: 6, podcast: 6, music: 6 } as const;

const DAY_MS = 86_400_000;

export interface LiveWorkRow {
  id: string;
  slug: string;
  kind: "live" | "exhibition";
  title: string;
  venue: string | null;
  event_date: string | null;
  event_end_date: string | null;
  poster_url: string | null;
}

/** 「排進行程」要開什麼：電影／影集先用 TMDB id 建作品；場外直接帶名稱＋場地＋日期進場外變體 */
export type PlanTarget =
  | { type: "tmdb"; kind: "movie" | "series"; tmdbId: number }
  | {
      type: "live";
      place: "live" | "exhibition";
      name: string;
      venue: string;
      dates: string;
      /** datetime-local 預填值（台北牆上時間）；空字串＝讓人自己選 */
      custom: string;
    };

/** Podcast 榜單的節目：按下去才讀 RSS、預選最新一集（podcast-plan-button.tsx） */
export interface PodcastPlan {
  type: "podcast";
  itunesId: number;
  feedUrl: string;
  show: string;
}

/** 音樂榜單的專輯：按下去才建作品（music-plan-button.tsx） */
export interface MusicPlan {
  type: "music";
  itunesId: number;
  title: string;
}

export type CardPlan = PlanTarget | PodcastPlan | MusicPlan;

/** 卡片分類＝品味的媒介六類 */
export type CardMedia = MediaKey;

export interface BeforeCard {
  key: string;
  title: string;
  posterUrl: string | null;
  meta: string;
  /** 沒海報時的字卡樣式 */
  placeholder: "screen" | "podcast" | "music" | "live" | "exhibition";
  /** 場外字卡封面的場地與日期（封面補齊）；影劇沒有 */
  coverDetails?: { venue: string | null; eventDate: string | null; eventEndDate: string | null };
  /** 已有作品（場外）才有；給次鈕插槽（在哪看／去哪買票）用 */
  workId: string | null;
  plan: CardPlan;
  /** 往外開的次鈕（文化部活動的售票頁／活動頁） */
  link?: { href: string; label: string };
  /** 來自文化部開放資料：區塊底部要標示來源 */
  fromCulture?: true;
  /** 來自多來源收集（KKTIX／OPENTIX／Accupass／北美館）：區塊底部列出實際用到的來源 */
  eventSource?: EventSource;
  /** 演出細類（演唱會／戲劇／舞蹈／音樂祭）：演出分頁的小標籤用；一般演出沒有 */
  subcategory?: LiveSubcategory;
}

/** 電影／影集／場外的卡：主鈕一定是 PlanButton（推薦區也共用） */
export type PlannableCard = BeforeCard & { plan: PlanTarget };

export interface BeforeSources {
  nowPlaying: readonly ScreenResult[];
  upcoming: readonly ScreenResult[];
  series: readonly ScreenResult[];
  live: readonly LiveWorkRow[];
  /** 藝文活動：文化部＋多來源合併（已過濾 30 天、去重、排序、上限） */
  culture?: SourcedEvents;
  /** Apple 台灣 Podcast 本週榜單 */
  podcasts?: readonly PodcastShowResult[];
  /** Apple Music 台灣熱門專輯 */
  albums?: readonly MusicAlbumResult[];
}

const SCREEN_META: Record<string, string> = {
  now_playing: "正在上映",
  upcoming: "即將上映",
  trending: "本週熱門",
};

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function liveWindow(today: string): { from: string; to: string } {
  return { from: today, to: addDays(today, LIVE_WINDOW_DAYS) };
}

export function screenCards(
  kind: "movie" | "series",
  sectionKey: string,
  items: readonly ScreenResult[],
  limit: number,
): PlannableCard[] {
  const label = `${kind === "movie" ? "電影" : "影集"}・${SCREEN_META[sectionKey] ?? "本週熱門"}`;
  return items.slice(0, limit).map((item) => ({
    key: `${kind}:${item.tmdbId}`,
    title: item.title,
    posterUrl: item.posterUrl,
    // 即將上映帶日期（Dex 10/13）：「電影・10.16 上映」；其他組照標籤
    meta: sectionKey === "upcoming" && item.releaseDate ? `電影・${shortDate(item.releaseDate)} 上映` : label,
    placeholder: "screen",
    workId: null,
    plan: { type: "tmdb", kind, tmdbId: item.tmdbId },
  }));
}

function liveDateLabel(row: LiveWorkRow, today: string): string | null {
  const start = row.event_date;
  if (!start) return null;
  const end = row.event_end_date && row.event_end_date !== start ? row.event_end_date : null;
  if (row.kind === "exhibition") {
    if (start > today) return `${shortDate(start)} 開展`;
    return end ? `到 ${shortDate(end)}` : shortDate(start);
  }
  return end ? `${shortDate(start)} – ${shortDate(end)}` : shortDate(start);
}

function liveDatesText(row: LiveWorkRow): string {
  if (!row.event_date) return "";
  const end = row.event_end_date && row.event_end_date !== row.event_date ? row.event_end_date : null;
  return end ? `${fullDate(row.event_date)} – ${fullDate(end)}` : fullDate(row.event_date);
}

export function liveCard(row: LiveWorkRow, today: string): PlannableCard {
  const meta = [row.kind === "exhibition" ? "展覽" : "演出", row.venue, liveDateLabel(row, today)]
    .filter(Boolean)
    .join("・");
  // 演出還沒開始才預填當天晚上；展覽什麼時候去由人決定
  const custom = row.kind === "live" && row.event_date && row.event_date >= today ? `${row.event_date}T${LIVE_DEFAULT_TIME}` : "";
  return {
    key: `work:${row.id}`,
    title: row.title,
    posterUrl: row.poster_url,
    meta,
    placeholder: row.kind,
    coverDetails: { venue: row.venue, eventDate: row.event_date, eventEndDate: row.event_end_date },
    workId: row.id,
    plan: { type: "live", place: row.kind, name: row.title, venue: row.venue ?? "", dates: liveDatesText(row), custom },
  };
}

/** 依序去重（前面的組優先），各組再取上限 */
function dedupeGroups(groups: ReadonlyArray<{ cards: BeforeCard[]; limit: number }>): BeforeCard[][] {
  const seen = new Set<string>();
  return groups.map(({ cards, limit }) => {
    const fresh = cards.filter((card) => !seen.has(card.key)).slice(0, limit);
    fresh.forEach((card) => seen.add(card.key));
    return fresh;
  });
}

function interleave(groups: readonly BeforeCard[][]): BeforeCard[] {
  const rounds = Math.max(0, ...groups.map((group) => group.length));
  return Array.from({ length: rounds }, (_, round) => groups.flatMap((group) => (group[round] ? [group[round]] : []))).flat();
}

export function buildBeforeCards(sources: BeforeSources, today: string): BeforeCard[] {
  const culture = sources.culture ?? { live: [], exhibition: [] };
  const cultureLive = dropCommunityDuplicates(culture.live, sources.live).map((event) => cultureCard(event, today));
  const cultureExhibition = dropCommunityDuplicates(culture.exhibition, sources.live).map((event) => cultureCard(event, today));
  const groups = dedupeGroups([
    { cards: screenCards("movie", "now_playing", sources.nowPlaying, sources.nowPlaying.length), limit: CARD_LIMITS.nowPlaying },
    { cards: sources.live.map((row) => liveCard(row, today)), limit: CARD_LIMITS.live },
    { cards: cultureLive, limit: cultureLive.length },
    { cards: screenCards("movie", "upcoming", sources.upcoming, sources.upcoming.length), limit: CARD_LIMITS.upcoming },
    { cards: podcastCards(sources.podcasts ?? [], CARD_LIMITS.podcast), limit: CARD_LIMITS.podcast },
    { cards: cultureExhibition, limit: cultureExhibition.length },
    { cards: musicCards(sources.albums ?? [], CARD_LIMITS.music), limit: CARD_LIMITS.music },
    { cards: screenCards("series", "trending", sources.series, sources.series.length), limit: CARD_LIMITS.series },
  ]);
  return interleave(groups);
}

/** 品味排序：卡片屬於哪種媒介 */
export function cardMedia(card: BeforeCard): CardMedia {
  if (card.plan.type === "tmdb") return card.plan.kind;
  if (card.plan.type === "podcast") return "podcast";
  if (card.plan.type === "music") return "music";
  return card.plan.place;
}

/** 在家看的、聽的（影集、Podcast、音樂）對應「在家」，其他都要出門（上映中電影、演出、展覽） */
const SETTING_WEIGHT = 0.5;
const HOME_MEDIA: ReadonlySet<CardMedia> = new Set(["series", "podcast", "music"]);
/** 保底：前 4 張至少兩種、前 8 張至少三種（拿得出來的話） */
const MIX_RULES = [
  { window: 4, kinds: 2 },
  { window: 8, kinds: 3 },
] as const;

/** 問卷⑤選了的演出細類（Q-63）：加一點分，排在其他演出前面、略勝同分的其他類，但蓋不過媒介分佈 */
const LIVE_KIND_WEIGHT = 0.1;

function tasteScore(card: BeforeCard, profile: TasteProfile): number {
  const media = cardMedia(card);
  const side = HOME_MEDIA.has(media) ? profile.setting.home : profile.setting.out;
  const liked = card.subcategory && profile.liveKinds.includes(card.subcategory) ? LIVE_KIND_WEIGHT : 0;
  return profile.media[media] + SETTING_WEIGHT * side + liked;
}

/**
 * 前 window 張不到 kinds 種：把後面第一張新種類的，插到前 window 張裡「最後一張重複種類」的位置（其餘順延）。
 * 拿不出新種類就停。
 */
function ensureKinds(cards: readonly BeforeCard[], window: number, kinds: number): BeforeCard[] {
  let result = [...cards];
  for (;;) {
    const head = result.slice(0, window);
    const present = new Set(head.map(cardMedia));
    if (head.length < window || present.size >= kinds) return result;
    const incoming = result.findIndex((card, index) => index >= window && !present.has(cardMedia(card)));
    if (incoming < 0) return result;
    const counts = head.reduce((map, card) => map.set(cardMedia(card), (map.get(cardMedia(card)) ?? 0) + 1), new Map<CardMedia, number>());
    const slot = head.findLastIndex((card) => (counts.get(cardMedia(card)) ?? 0) > 1);
    const moved = result[incoming];
    const rest = result.filter((_, index) => index !== incoming);
    result = [...rest.slice(0, slot), moved, ...rest.slice(slot)];
  }
}

function ensureMix(cards: readonly BeforeCard[]): BeforeCard[] {
  return MIX_RULES.reduce<BeforeCard[]>((current, rule) => ensureKinds(current, rule.window, rule.kinds), [...cards]);
}

/**
 * 散場之前依品味資料排序（Q-43）：偏演出就演出在前；同分維持原本輪流排的順序（stable sort）。
 * 問卷⑤選了演出細類（Q-63）的，該細類排在其他演出前面。
 * 沒有任何品味訊號就維持輪流排；兩種情況都套保底（不能又全是電影）。
 */
export function rankCardsByTaste(cards: readonly BeforeCard[], profile: TasteProfile | null): BeforeCard[] {
  if (!profile || (!profile.hasSignal && profile.liveKinds.length === 0)) return ensureMix(cards);
  const ranked = cards
    .map((card, index) => ({ card, index, score: tasteScore(card, profile) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ card }) => card);
  return ensureMix(ranked);
}
