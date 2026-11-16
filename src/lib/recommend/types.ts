/** 作品推薦的領域型別（純資料，server／client 都可 import） */

import type { BeforeCard, PlanTarget } from "@/lib/before/cards";
import type { WorkLink } from "@/lib/links/types";
import type { MediaKey, TasteProfile } from "@/lib/taste/types";

export type ScreenKind = "movie" | "series";

/** 種子從哪來：寫過（任何公開範圍，只給本人看）、記過、排了 */
export type SeedSource = "wrote" | "logged" | "planned";

export interface Seed {
  workId: string;
  title: string;
  media: MediaKey;
  /** 電影／影集才有 */
  tmdbId: number | null;
  source: SeedSource;
}

/** 已經記過、排過、寫過的作品：不再推 */
export interface Exclusions {
  /** `movie:123`／`series:456` */
  screenKeys: ReadonlySet<string>;
  workIds: ReadonlySet<string>;
}

export interface Signals {
  seeds: readonly Seed[];
  exclusions: Exclusions;
  taste: TasteProfile | null;
}

export interface Person {
  id: number;
  name: string;
}

export interface Genre {
  id: number;
  name: string;
}

/** TMDB 詳情裡推薦要用的部分 */
export interface TmdbInfo {
  genres: Genre[];
  /** 電影＝導演；影集＝主創 */
  directors: Person[];
  cast: Person[];
  /** 同一種（movie／tv）的 TMDB id */
  recommendations: number[];
  similar: number[];
}

export type CandidateLink = Pick<WorkLink, "label" | "url">;

/** 候選池的一張卡：沿用散場之前的卡片欄位，Podcast 沒有「排進行程」 */
export interface Candidate {
  card: Omit<BeforeCard, "plan"> & { plan: PlanTarget | null };
  media: MediaKey;
  screen: { kind: ScreenKind; tmdbId: number } | null;
  link: CandidateLink | null;
}

/** 打分時記下每一個加分來源，最後挑貢獻最大的當理由 */
export type Reason =
  | { type: "hit"; seed: Seed }
  | { type: "director"; seed: Seed; name: string }
  | { type: "cast"; seed: Seed; name: string }
  | { type: "genre"; seed: Seed; name: string }
  | { type: "taste"; media: MediaKey; side: "home" | "out" | null };

export interface Recommendation {
  candidate: Candidate;
  score: number;
  reason: string;
}
