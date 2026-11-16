/**
 * 「在哪看」：TMDB watch providers（資料來自 JustWatch），只取台灣（results.TW）。
 *
 * 欄位（TMDB 文件 movie/{id}/watch/providers、tv/{id}/watch/providers）：
 * results.{國碼} = { link, flatrate?, rent?, buy?, ads?, free? }，
 * 每個 provider = { provider_id, provider_name, logo_path, display_priority }。
 * TMDB 不給各平台深連結，只有 link（TMDB 的觀看頁，資料由 JustWatch 提供）→ 每列都連到 link，
 * 並依 TMDB 條款標註 JustWatch。
 */

import { tmdbGet, type TmdbDeps } from "@/lib/work-picker/tmdb";

export type ProviderKind = "subscription" | "rent" | "buy";

export interface WatchProvider {
  name: string;
  kind: ProviderKind;
  link: string;
}

/** 存進 works.watch_providers 的快照；狀態在讀取時依 releaseDate 與當下時間再算 */
export interface WatchSnapshot {
  providers: WatchProvider[];
  link: string | null;
  /** 電影上映日 YYYY-MM-DD（影集不適用，為 null） */
  releaseDate: string | null;
}

export type WatchStatus = "available" | "in_theaters" | "none";

export const WATCH_REGION = "TW";
export const IN_THEATERS_WINDOW_DAYS = 60;
export const WATCH_ATTRIBUTION = "資料來源：JustWatch / TMDB";

const DAY_MS = 24 * 60 * 60 * 1000;

/** flatrate（訂閱）優先，其次 rent、buy */
const KIND_ORDER: Array<{ key: string; kind: ProviderKind }> = [
  { key: "flatrate", kind: "subscription" },
  { key: "rent", kind: "rent" },
  { key: "buy", kind: "buy" },
];

export const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  subscription: "訂閱",
  rent: "租借",
  buy: "購買",
};

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerEntries(list: unknown): Array<{ name: string; priority: number }> {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isRecord)
    .map((item) => ({
      name: typeof item.provider_name === "string" ? item.provider_name.trim() : "",
      priority: typeof item.display_priority === "number" ? item.display_priority : Number.MAX_SAFE_INTEGER,
    }))
    .filter((item) => item.name.length > 0)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 解析 watch providers 回應的 results.TW。
 * 同一平台同時出現在多類（例：Apple TV Store 租也可買）只列一次，取最優先那類。
 */
export function parseRegionProviders(
  data: unknown,
  region: string = WATCH_REGION,
): { providers: WatchProvider[]; link: string | null } {
  const results = isRecord(data) && isRecord(data.results) ? data.results : null;
  const entry = results && isRecord(results[region]) ? (results[region] as Raw) : null;
  if (!entry) return { providers: [], link: null };
  const link = typeof entry.link === "string" && entry.link ? entry.link : null;
  if (!link) return { providers: [], link: null };

  const seen = new Set<string>();
  const providers = KIND_ORDER.flatMap(({ key, kind }) =>
    providerEntries(entry[key]).flatMap(({ name }) => {
      if (seen.has(name)) return [];
      seen.add(name);
      return [{ name, kind, link }];
    }),
  );
  return { providers, link };
}

/** 有平台 → available；無平台且已上映、上映日在 60 天內 → in_theaters；其餘（含尚未上映）none */
export function deriveWatchStatus(snapshot: WatchSnapshot | null, now: Date): WatchStatus {
  if (!snapshot) return "none";
  if (snapshot.providers.length > 0) return "available";
  if (!snapshot.releaseDate) return "none";
  const release = Date.parse(`${snapshot.releaseDate}T00:00:00Z`);
  if (Number.isNaN(release)) return "none";
  const age = now.getTime() - release;
  return age >= 0 && age <= IN_THEATERS_WINDOW_DAYS * DAY_MS ? "in_theaters" : "none";
}

function releaseDateOf(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * 打 TMDB：電影用 movie/{id}?append_to_response=watch/providers（一次拿到 release_date），
 * 影集用 tv/{id}/watch/providers。失敗丟 TmdbError，由呼叫端決定降級。
 */
export async function fetchWatchSnapshot(
  kind: "movie" | "series",
  tmdbId: number,
  deps: TmdbDeps,
): Promise<WatchSnapshot> {
  if (kind === "movie") {
    const data = await tmdbGet(`/movie/${tmdbId}`, { append_to_response: "watch/providers" }, deps);
    const parsed = parseRegionProviders(data["watch/providers"]);
    return { ...parsed, releaseDate: releaseDateOf(data.release_date) };
  }
  const data = await tmdbGet(`/tv/${tmdbId}/watch/providers`, {}, deps);
  return { ...parseRegionProviders(data), releaseDate: null };
}

/** DB jsonb → 快照（外部資料一律驗過再用；格式不對回 null 視同沒快取） */
export function parseStoredSnapshot(raw: unknown): WatchSnapshot | null {
  if (!isRecord(raw) || !Array.isArray(raw.providers)) return null;
  const providers = raw.providers.flatMap((item): WatchProvider[] => {
    if (!isRecord(item)) return [];
    const { name, kind, link } = item;
    if (typeof name !== "string" || typeof link !== "string") return [];
    if (kind !== "subscription" && kind !== "rent" && kind !== "buy") return [];
    return [{ name, kind, link }];
  });
  return {
    providers,
    link: typeof raw.link === "string" ? raw.link : null,
    releaseDate: releaseDateOf(raw.releaseDate),
  };
}
