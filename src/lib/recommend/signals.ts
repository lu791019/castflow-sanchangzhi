/**
 * 推薦訊號（純函式）：使用者自己寫過（任何公開範圍）、記過、排過的作品＋品味資料。
 * 這些私人資料只在本人的散場之前拿來推薦，不出現在任何別人看得到的地方。
 */

import { mediaOfWorkKind } from "@/lib/taste/profile";
import type { JournalStatus } from "@/lib/journal/types";
import type { TasteProfile } from "@/lib/taste/types";
import type { WorkKind } from "@/lib/works/format";
import { MAX_SEEDS } from "./constants";
import type { Seed, SeedSource, Signals } from "./types";

export interface SeedRow {
  workId: string;
  title: string;
  kind: WorkKind;
  tmdbId: number | null;
}

export interface JournalSeedRow extends SeedRow {
  status: JournalStatus;
}

export interface SignalInputs {
  written: readonly SeedRow[];
  journals: readonly JournalSeedRow[];
  taste: TasteProfile | null;
}

export function screenKey(kind: "movie" | "series", tmdbId: number): string {
  return `${kind}:${tmdbId}`;
}

function isScreenKind(kind: WorkKind): kind is "movie" | "series" {
  return kind === "movie" || kind === "series";
}

function toSeed(row: SeedRow, source: SeedSource): Seed {
  return { workId: row.workId, title: row.title, media: mediaOfWorkKind(row.kind), tmdbId: row.tmdbId, source };
}

const JOURNAL_SOURCE: Record<JournalSeedRow["status"], SeedSource | null> = {
  recorded: "logged",
  said: "logged",
  planned: "planned",
  // 跳過的不當種子（可能根本沒看），但照樣不再推
  skipped: null,
};

export function buildSignals({ written, journals, taste }: SignalInputs): Signals {
  const ordered: Seed[] = [
    ...written.map((row) => toSeed(row, "wrote")),
    ...journals.flatMap((row) => {
      const source = JOURNAL_SOURCE[row.status];
      return source ? [toSeed(row, source)] : [];
    }),
  ];
  // TMDB 推薦只對電影／影集有用：沒有 TMDB id 的不當種子
  const seeds = ordered
    .filter((seed, index) => seed.tmdbId !== null && ordered.findIndex((other) => other.workId === seed.workId) === index)
    .slice(0, MAX_SEEDS);

  const all = [...written, ...journals];
  return {
    seeds,
    exclusions: {
      screenKeys: new Set(all.flatMap((row) => (row.tmdbId !== null && isScreenKind(row.kind) ? [screenKey(row.kind, row.tmdbId)] : []))),
      workIds: new Set(all.map((row) => row.workId)),
    },
    taste,
  };
}

/** 新用戶（沒寫過、沒記過也沒填問卷）整區不顯示 */
export function hasEnoughSignal(signals: Signals): boolean {
  return signals.seeds.length > 0 || Boolean(signals.taste?.hasSignal);
}
