/**
 * 散場之前「你可能會想看」（server only）：訊號 → 候選池 → TMDB 詳情（快取 24h）→ 打分。
 * 上游失敗不擋首屏：TMDB（上映、熱門影集、種子詳情）讀不到 → 整區先不顯示＋warn；
 * Podcast 榜、場刊、候選詳情讀不到 → 那部分略過＋warn。整區有時限，逾時同樣不顯示＋warn。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { listUpcomingLiveWorks } from "@/lib/before/repository";
import type { LiveWorkRow } from "@/lib/before/cards";
import { communityEnabled } from "@/lib/features";
import { taipeiDateKey } from "@/lib/journal/time";
import { loadTasteProfile } from "@/lib/taste/load";
import { loadTrending } from "@/lib/trending/service";
import type { TrendingPayload } from "@/lib/trending/types";
import { tmdbDepsFromEnv } from "@/lib/work-picker/tmdb";
import type { PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { buildCandidates } from "./candidates";
import { MAX_DETAIL_CANDIDATES, RECOMMEND_DEADLINE_MS } from "./constants";
import { loadJournalWorks, loadWrittenWorks } from "./repository";
import { recommend } from "./score";
import { buildSignals, hasEnoughSignal } from "./signals";
import { fetchInfoBatch, type InfoRequest } from "./tmdb-fetch";
import type { Candidate, Recommendation, Signals } from "./types";

class RecommendUnavailable extends Error {}

function warn(title: string, detail: string): void {
  console.error("[recommend]", title, detail);
  void getServerNotify()("warn", `你可能會想看：${title}`, detail).catch(() => undefined);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 可以少的來源：讀不到就略過＋warn */
async function optional<T>(label: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    warn(`${label}讀不到，先略過`, describe(error));
    return empty;
  }
}

/** 少了就推不準的來源：讀不到整區不顯示 */
async function required<T>(label: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    throw new RecommendUnavailable(`${label}：${describe(error)}`);
  }
}

function section<T>(payload: TrendingPayload, key: string): T[] {
  return (payload.sections.find((item) => item.key === key)?.items ?? []) as T[];
}

async function loadSignals(userId: string): Promise<Signals> {
  const [written, journals, taste] = await Promise.all([
    required("寫過的作品", () => loadWrittenWorks(userId)),
    required("日誌作品", () => loadJournalWorks(userId)),
    optional("品味資料", () => loadTasteProfile(userId), null),
  ]);
  return buildSignals({ written, journals, taste });
}

async function loadCandidates(signals: Signals, today: string): Promise<Candidate[]> {
  const [movies, series, podcasts, live] = await Promise.all([
    required("上映電影", () => loadTrending("movie")),
    required("本週熱門影集", () => loadTrending("series")),
    optional("Podcast 榜", () => loadTrending("podcast"), null),
    communityEnabled() ? optional("場外場刊", () => listUpcomingLiveWorks(today), [] as LiveWorkRow[]) : Promise.resolve([]),
  ]);
  return buildCandidates(
    {
      nowPlaying: section<ScreenResult>(movies, "now_playing"),
      upcoming: section<ScreenResult>(movies, "upcoming"),
      series: section<ScreenResult>(series, "trending"),
      podcasts: podcasts ? section<PodcastShowResult>(podcasts, "top") : [],
      live,
    },
    today,
    signals.exclusions,
  );
}

async function compute(userId: string, now: Date): Promise<Recommendation[]> {
  const signals = await loadSignals(userId);
  if (!hasEnoughSignal(signals)) return [];
  const candidates = await loadCandidates(signals, taipeiDateKey(now));
  const deps = tmdbDepsFromEnv();
  const seedRequests: InfoRequest[] = signals.seeds.flatMap((seed) =>
    seed.tmdbId !== null && (seed.media === "movie" || seed.media === "series") ? [{ key: seed.workId, kind: seed.media, tmdbId: seed.tmdbId }] : [],
  );
  const candidateRequests: InfoRequest[] = candidates
    .flatMap((candidate) => (candidate.screen ? [{ key: candidate.card.key, ...candidate.screen }] : []))
    .slice(0, MAX_DETAIL_CANDIDATES);
  const [seedBatch, candidateBatch] = await Promise.all([fetchInfoBatch(seedRequests, deps), fetchInfoBatch(candidateRequests, deps)]);
  if (seedBatch.failures.length > 0) throw new RecommendUnavailable(`種子作品詳情：${seedBatch.failures.join("；")}`);
  if (candidateBatch.failures.length > 0) {
    warn("部分作品詳情讀不到，先不算導演、演員、類型", `${candidateBatch.failures.length} 部：${candidateBatch.failures.slice(0, 3).join("；")}`);
  }
  return recommend(signals, candidates, seedBatch.infos, candidateBatch.infos);
}

/** 永不丟錯：任何上游失敗或逾時 → 回空陣列（整區不顯示）＋warn */
export async function loadRecommendations(userId: string, now: Date): Promise<Recommendation[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RecommendUnavailable(`超過 ${RECOMMEND_DEADLINE_MS / 1000} 秒還沒算完`)), RECOMMEND_DEADLINE_MS);
  });
  try {
    return await Promise.race([compute(userId, now), timeout]);
  } catch (error) {
    warn("整區先不顯示", describe(error));
    return [];
  } finally {
    clearTimeout(timer);
  }
}
