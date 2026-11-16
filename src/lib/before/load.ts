/**
 * 散場之前首屏資料（server only）：① 這週上映・開演・開展（電影、影集、Podcast 榜單、音樂熱門專輯、社群場刊、文化部＋多來源藝文活動）、
 * ② 你排好的（只讀本人）、③ 有人說了（目錄最新 3 篇）。
 * 出門類（演出、展覽）依本人記住的縣市先過濾再合併取上限（events/pool.ts）；演出細類另給一池給小標籤。
 * 任何一塊讀不到都不擋整頁：該塊留空並推 warn 警報（降級不可靜默）。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import type { EventSource } from "@/lib/events/collected";
import type { CultureEvent } from "@/lib/events/culture";
import { loadCultureCatalog } from "@/lib/events/load";
import { buildEventPool } from "@/lib/events/pool";
import { listWindowEvents, type StoredEvent } from "@/lib/events/repository";
import { communityEnabled } from "@/lib/features";
import type { FeedEntry } from "@/lib/feed/entries";
import { loadFeedEntries } from "@/lib/feed/load-entries";
import { taipeiDateKey } from "@/lib/journal/time";
import { loadUpcomingPlansView } from "@/lib/journal/month-view";
import type { JournalViewEntry } from "@/lib/journal/view";
import { loadTasteProfile } from "@/lib/taste/load";
import type { TasteProfile } from "@/lib/taste/types";
import { loadTrending } from "@/lib/trending/service";
import type { TrendingPayload } from "@/lib/trending/types";
import type { MusicAlbumResult, PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { buildBeforeCards, cardMedia, liveWindow, rankCardsByTaste, type BeforeCard, type LiveWorkRow } from "./cards";
import { loadBeforeCity } from "./city-repository";
import { cultureCard, dropCommunityDuplicates } from "./culture-cards";
import type { CityFilter } from "./live-filter";
import { listUpcomingLiveWorks } from "./repository";

export const SAID_LIMIT = 3;

export interface BeforeView {
  cards: BeforeCard[];
  /** 場外（演出、展覽）有沒有任何一筆：沒有時①底下另外說一句 */
  hasLive: boolean;
  /** 有文化部開放資料的卡：①底部標示資料來源 */
  hasCulture: boolean;
  /** 卡片實際用到的多來源（KKTIX／OPENTIX／Accupass／北美館）：①底部列出 */
  eventSources: EventSource[];
  /** 演出細類的卡（演唱會／戲劇／舞蹈／音樂祭各最多 12 張）：演出分頁小標籤用 */
  liveSub: BeforeCard[];
  cityFilter: CityFilter;
  upcoming: JournalViewEntry[];
  said: FeedEntry[];
}

/** ①「這週上映・開演・開展」那一區要的資料（換縣市後 API 直接回這份，畫面不等 router.refresh） */
export type ThisWeekView = Pick<BeforeView, "cards" | "hasLive" | "hasCulture" | "eventSources" | "liveSub" | "cityFilter">;

export function thisWeekOf(view: BeforeView): ThisWeekView {
  const { cards, hasLive, hasCulture, eventSources, liveSub, cityFilter } = view;
  return { cards, hasLive, hasCulture, eventSources, liveSub, cityFilter };
}

async function orEmpty<T>(label: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[before] 讀取失敗，先留空", { label, detail });
    void getServerNotify()("warn", `散場之前：${label}讀不到`, detail).catch(() => undefined);
    return empty;
  }
}

function sectionItems(payload: TrendingPayload, key: string): ScreenResult[] {
  if (payload.kind !== "movie" && payload.kind !== "series") return [];
  return payload.sections.find((section) => section.key === key)?.items ?? [];
}

function albumItems(payload: TrendingPayload | null): MusicAlbumResult[] {
  return payload?.kind === "music" ? payload.sections.flatMap((section) => section.items) : [];
}

function podcastItems(payload: TrendingPayload | null): PodcastShowResult[] {
  return payload?.kind === "podcast" ? payload.sections.flatMap((section) => section.items) : [];
}

export async function loadBeforeView(userId: string, now: Date): Promise<BeforeView> {
  const today = taipeiDateKey(now);
  const eventWindow = liveWindow(today);
  const [movies, series, podcasts, albums, culture, collected, community, upcoming, feed, taste, city] = await Promise.all([
    orEmpty("上映電影", () => loadTrending("movie"), null),
    orEmpty("本週熱門影集", () => loadTrending("series"), null),
    orEmpty("Podcast 本週榜單", () => loadTrending("podcast"), null),
    orEmpty("音樂本週熱門", () => loadTrending("music"), null),
    // 文化部各類別失敗已在 loader 內各自警報並留空；這裡只接意外
    orEmpty("文化部藝文活動", () => loadCultureCatalog(), [] as CultureEvent[]),
    // worker 每天收進 events 表；這裡只讀不爬
    orEmpty("多來源藝文活動", () => listWindowEvents(eventWindow.from, eventWindow.to), [] as StoredEvent[]),
    communityEnabled() ? orEmpty("場外活動", () => listUpcomingLiveWorks(today), [] as LiveWorkRow[]) : Promise.resolve([]),
    orEmpty("你排好的", () => loadUpcomingPlansView(userId, now), [] as JournalViewEntry[]),
    orEmpty("有人說了", () => loadFeedEntries(), [] as FeedEntry[]),
    orEmpty("品味資料", () => loadTasteProfile(userId), null as TasteProfile | null),
    // 讀不到就看全部縣市
    orEmpty("縣市篩選", () => loadBeforeCity(userId), null as string | null),
  ]);
  const pool = buildEventPool({ culture, stored: collected, today, city });
  // 社群場刊沒有縣市資料：只在「全部縣市」出現
  const live = city ? [] : community;
  const built = buildBeforeCards(
    {
      nowPlaying: movies ? sectionItems(movies, "now_playing") : [],
      upcoming: movies ? sectionItems(movies, "upcoming") : [],
      series: series ? sectionItems(series, "trending") : [],
      live,
      culture: pool.main,
      podcasts: podcastItems(podcasts),
      albums: albumItems(albums),
    },
    today,
  );
  // 品味資料讀不到就維持輪流排
  const cards = rankCardsByTaste(built, taste);
  const liveSub = dropCommunityDuplicates(pool.liveBySubcategory, live).map((event) => cultureCard(event, today));
  const shown = [...cards, ...liveSub];
  return {
    cards,
    // 選了縣市：沒場次由篩選區自己說（換個縣市看看），不出「還沒有人記下」
    hasLive: city !== null || cards.some((card) => cardMedia(card) === "live" || cardMedia(card) === "exhibition"),
    hasCulture: shown.some((card) => card.fromCulture),
    eventSources: [...new Set(shown.flatMap((card) => (card.eventSource ? [card.eventSource] : [])))],
    liveSub,
    cityFilter: { city, cities: pool.cities },
    upcoming,
    said: feed.slice(0, SAID_LIMIT),
  };
}
