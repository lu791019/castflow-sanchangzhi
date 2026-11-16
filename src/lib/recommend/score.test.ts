import { describe, expect, it } from "vitest";
import type { TasteProfile } from "@/lib/taste/types";
import { recommend, scoreCandidate } from "./score";
import type { Candidate, Seed, Signals, TmdbInfo } from "./types";

const EMPTY_INFO: TmdbInfo = { genres: [], directors: [], cast: [], recommendations: [], similar: [] };
const info = (patch: Partial<TmdbInfo>): TmdbInfo => ({ ...EMPTY_INFO, ...patch });

const voice: Seed = { workId: "w1", title: "人聲", media: "movie", tmdbId: 100, source: "wrote" };
const master: Seed = { workId: "w2", title: "師父", media: "movie", tmdbId: 200, source: "logged" };

function screen(tmdbId: number, title: string, kind: "movie" | "series" = "movie"): Candidate {
  return {
    card: { key: `${kind}:${tmdbId}`, title, posterUrl: null, meta: "", placeholder: "screen", workId: null, plan: { type: "tmdb", kind, tmdbId } },
    media: kind,
    screen: { kind, tmdbId },
    link: null,
  };
}

function liveCandidate(id: string, title: string): Candidate {
  return {
    card: { key: `work:${id}`, title, posterUrl: null, meta: "", placeholder: "live", workId: id, plan: null },
    media: "live",
    screen: null,
    link: null,
  };
}

const noTaste = null;
const signals = (seeds: Seed[], taste: TasteProfile | null = noTaste): Signals => ({
  seeds,
  exclusions: { screenKeys: new Set(), workIds: new Set() },
  taste,
});

const outLive: TasteProfile = {
  media: { movie: 0, series: 0, podcast: 0, music: 0, live: 1, exhibition: 0 },
  setting: { home: 0, out: 1 },
  works: [],
  passages: [],
  behaviorCount: 0,
  usedQuestionnaire: true,
  hasSignal: true,
  liveKinds: [],
};

describe("scoreCandidate", () => {
  const seedInfos = new Map<string, TmdbInfo>([
    ["w1", info({ recommendations: [1], similar: [2], directors: [{ id: 9, name: "阿莫多瓦" }], genres: [{ id: 18, name: "劇情" }], cast: [{ id: 7, name: "蒂妲史雲頓" }] })],
    ["w2", info({ recommendations: [1] })],
  ]);

  it("recommendations 命中＋寫過：分數最高、理由引用寫過的作品", () => {
    const scored = scoreCandidate(screen(1, "新片"), signals([voice, master]), seedInfos, null);
    // 人聲 3×1 ＋ 師父 3×0.6
    expect(scored.score).toBeCloseTo(4.8);
    expect(scored.reason).toBe("因為你寫過〈人聲〉");
  });

  it("similar 命中比 recommendations 輕", () => {
    expect(scoreCandidate(screen(2, "相似片"), signals([voice]), seedInfos, null).score).toBe(2);
  });

  it("同導演、同演員、同類型都從候選的詳情算", () => {
    const candidateInfo = info({ directors: [{ id: 9, name: "阿莫多瓦" }], cast: [{ id: 7, name: "蒂妲史雲頓" }], genres: [{ id: 18, name: "劇情" }] });
    const scored = scoreCandidate(screen(3, "導演新作"), signals([voice]), seedInfos, candidateInfo);
    expect(scored.score).toBeCloseTo(2 + 1 + 0.5);
    expect(scored.reason).toBe("跟你寫過的〈人聲〉同一位導演・阿莫多瓦");
  });

  it("電影種子的 TMDB 名單不套到影集（id 空間不同）", () => {
    expect(scoreCandidate(screen(1, "同號影集", "series"), signals([voice]), seedInfos, null).score).toBe(0);
  });

  it("品味資料：喜歡出門看演出 → 演出加分並說理由", () => {
    const scored = scoreCandidate(liveCandidate("l1", "落日飛車"), signals([], outLive), new Map(), null);
    expect(scored.score).toBe(3);
    expect(scored.reason).toBe("你喜歡出門看演出");
  });
});

describe("recommend", () => {
  it("沒有訊號就是空的", () => {
    expect(recommend(signals([]), [screen(1, "新片")], new Map(), new Map())).toEqual([]);
  });

  it("低於門檻不推；依分數排序、最多 6 張", () => {
    const seedInfos = new Map([["w1", info({ recommendations: [1, 2, 3, 4, 5, 6, 7], similar: [8], genres: [{ id: 18, name: "劇情" }] })]]);
    const pool = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((id) => screen(id, `片${id}`));
    const candidateInfos = new Map([["movie:9", info({ genres: [{ id: 18, name: "劇情" }] })]]);
    const result = recommend(signals([voice]), pool, seedInfos, candidateInfos);
    expect(result).toHaveLength(6);
    // 1–7 都是 3 分，同分照原順序（7、6、5…），只類型重疊 0.5 的「片9」不推
    expect(result.map((item) => item.candidate.card.title)).toEqual(["片7", "片6", "片5", "片4", "片3", "片2"]);
    expect(result.every((item) => item.reason === "因為你寫過〈人聲〉")).toBe(true);
  });

  it("只填問卷：演出推出來，影集不推", () => {
    const result = recommend(signals([], outLive), [screen(5, "熱門影集", "series"), liveCandidate("l1", "落日飛車")], new Map(), new Map());
    expect(result.map((item) => [item.candidate.card.title, item.reason])).toEqual([["落日飛車", "你喜歡出門看演出"]]);
  });
});
