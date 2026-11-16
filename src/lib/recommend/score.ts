/**
 * 推薦打分（純函式）：
 * - 種子（寫過／記過／排了）的 TMDB recommendations、similar 名單命中
 * - 同導演（影集＝主創）、同演員、同類型（候選的 TMDB 詳情）
 * - 品味資料：媒介分佈與在家／出門
 * 每個加分來源都記下來，貢獻最大的那個寫成一句理由。權重見 constants.ts。
 */

import type { MediaKey, TasteProfile } from "@/lib/taste/types";
import {
  CAST_CAP,
  CAST_WEIGHT,
  DIRECTOR_WEIGHT,
  GENRE_CAP,
  GENRE_WEIGHT,
  HIT_WEIGHTS,
  MEDIA_WEIGHT,
  MIN_SCORE,
  RECOMMEND_LIMIT,
  SEED_WEIGHTS,
  SETTING_WEIGHT,
} from "./constants";
import { formatReason } from "./reason";
import { hasEnoughSignal } from "./signals";
import type { Candidate, Reason, Recommendation, Seed, Signals, TmdbInfo } from "./types";

interface Contribution {
  points: number;
  reason: Reason;
}

/** 種子的 TMDB 詳情，以 seed.workId 為 key */
export type SeedInfos = ReadonlyMap<string, TmdbInfo>;
/** 候選的 TMDB 詳情，以 card.key（movie:123）為 key */
export type CandidateInfos = ReadonlyMap<string, TmdbInfo>;

function shared<T extends { id: number }>(mine: readonly T[], theirs: readonly T[]): T[] {
  const ids = new Set(mine.map((item) => item.id));
  return theirs.filter((item) => ids.has(item.id));
}

function seedContributions(candidate: Candidate, seed: Seed, seedInfo: TmdbInfo, candidateInfo: TmdbInfo | null): Contribution[] {
  if (!candidate.screen || candidate.screen.kind !== seed.media) return [];
  const weight = SEED_WEIGHTS[seed.source];
  const { tmdbId } = candidate.screen;
  const hits: Contribution[] = [
    ...(seedInfo.recommendations.includes(tmdbId) ? [{ points: HIT_WEIGHTS.recommendations * weight, reason: { type: "hit", seed } as const }] : []),
    ...(seedInfo.similar.includes(tmdbId) ? [{ points: HIT_WEIGHTS.similar * weight, reason: { type: "hit", seed } as const }] : []),
  ];
  if (!candidateInfo) return hits;
  const directors = shared(seedInfo.directors, candidateInfo.directors);
  const cast = shared(seedInfo.cast, candidateInfo.cast).slice(0, CAST_CAP);
  const genres = shared(seedInfo.genres, candidateInfo.genres).slice(0, GENRE_CAP);
  return [
    ...hits,
    ...(directors.length > 0
      ? [{ points: DIRECTOR_WEIGHT * directors.length * weight, reason: { type: "director", seed, name: directors[0].name } as const }]
      : []),
    ...(cast.length > 0 ? [{ points: CAST_WEIGHT * cast.length * weight, reason: { type: "cast", seed, name: cast[0].name } as const }] : []),
    ...(genres.length > 0
      ? [{ points: GENRE_WEIGHT * genres.length * weight, reason: { type: "genre", seed, name: genres[0].name } as const }]
      : []),
  ];
}

/** 影集對應在家；電影、演出、展覽對應出門；Podcast、音樂在哪都能聽，不吃場域 */
function settingSide(media: MediaKey): "home" | "out" | null {
  if (media === "podcast" || media === "music") return null;
  return media === "series" ? "home" : "out";
}

function tasteContribution(media: MediaKey, taste: TasteProfile | null): Contribution | null {
  if (!taste?.hasSignal) return null;
  const side = settingSide(media);
  const sideShare = side ? taste.setting[side] : 0;
  const points = MEDIA_WEIGHT * taste.media[media] + SETTING_WEIGHT * sideShare;
  if (points <= 0) return null;
  return { points, reason: { type: "taste", media, side: sideShare > 0 ? side : null } };
}

export function scoreCandidate(
  candidate: Candidate,
  signals: Signals,
  seedInfos: SeedInfos,
  candidateInfo: TmdbInfo | null,
): { score: number; reason: string | null } {
  const contributions = [
    ...signals.seeds.flatMap((seed) => {
      const seedInfo = seedInfos.get(seed.workId);
      return seedInfo ? seedContributions(candidate, seed, seedInfo, candidateInfo) : [];
    }),
    ...[tasteContribution(candidate.media, signals.taste)].filter((item): item is Contribution => item !== null),
  ];
  if (contributions.length === 0) return { score: 0, reason: null };
  const score = contributions.reduce((sum, item) => sum + item.points, 0);
  // 同分取先出現的（命中 > 導演 > 演員 > 類型 > 品味；寫過 > 記過 > 排了）
  const best = contributions.reduce((top, item) => (item.points > top.points ? item : top));
  return { score, reason: formatReason(best.reason) };
}

export function recommend(
  signals: Signals,
  candidates: readonly Candidate[],
  seedInfos: SeedInfos,
  candidateInfos: CandidateInfos,
): Recommendation[] {
  if (!hasEnoughSignal(signals)) return [];
  return candidates
    .map((candidate, index) => ({ candidate, index, ...scoreCandidate(candidate, signals, seedInfos, candidateInfos.get(candidate.card.key) ?? null) }))
    .filter((item): item is typeof item & { reason: string } => item.reason !== null && item.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, RECOMMEND_LIMIT)
    .map(({ candidate, score, reason }) => ({ candidate, score, reason }));
}
