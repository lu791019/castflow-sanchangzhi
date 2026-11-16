/** API 邊界輸入驗證（純函式）：不信任任何外部 body */

import { isVenue, UUID_PATTERN, type Venue } from "./types";

export const MAX_TITLE_LENGTH = 200;
export const MAX_COMPANIONS_LENGTH = 200;
/** 超過這個容許值就是「計畫中」（排行程）；最遠排一年 */
export const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;
export const MAX_PLAN_AHEAD_DAYS = 365;
/** 星等（Q-72）：0.5～5、每 0.5 一階 */
export const MIN_RATING = 0.5;
export const MAX_RATING = 5;
const MAX_PLAN_AHEAD_MS = MAX_PLAN_AHEAD_DAYS * 24 * 60 * 60 * 1000;

export interface CreateJournalInput {
  workId: string | null;
  workTitle: string | null;
  experiencedAt: Date;
  venue: Venue;
  companions: string | null;
  /** 可不打；排行程（planned）不能打星 */
  rating: number | null;
  /** experiencedAt 在未來 → planned（排行程）；否則 recorded */
  status: "planned" | "recorded";
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function optionalText(value: unknown, field: string, max: number): ValidationResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${field} 必須是文字` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { ok: false, error: `${field} 不可超過 ${max} 字` };
  return { ok: true, value: trimmed || null };
}

/** 星等：沒給回 null；給了必須是 0.5～5 的 0.5 倍數 */
export function parseRating(value: unknown): ValidationResult<number | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, error: "rating 必須是數字" };
  if (value < MIN_RATING || value > MAX_RATING || !Number.isInteger(value * 2)) {
    return { ok: false, error: `rating 必須是 ${MIN_RATING}～${MAX_RATING}、每 0.5 一階` };
  }
  return { ok: true, value };
}

export function parseCreateJournalInput(
  body: unknown,
  now: Date = new Date(),
): ValidationResult<CreateJournalInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "body 必須是 JSON 物件" };
  const raw = body as Record<string, unknown>;

  const workId = raw.workId ?? null;
  if (workId !== null && (typeof workId !== "string" || !UUID_PATTERN.test(workId))) {
    return { ok: false, error: "workId 格式錯誤" };
  }

  const title = optionalText(raw.workTitle, "workTitle", MAX_TITLE_LENGTH);
  if (!title.ok) return title;
  if (workId === null && title.value === null) {
    return { ok: false, error: "workId 或 workTitle 至少要有一個" };
  }

  if (typeof raw.experiencedAt !== "string") {
    return { ok: false, error: "experiencedAt 必須是 ISO 時間字串" };
  }
  const experiencedAt = new Date(raw.experiencedAt);
  if (Number.isNaN(experiencedAt.getTime())) {
    return { ok: false, error: "experiencedAt 不是有效時間" };
  }
  const planned = experiencedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS;
  if (experiencedAt.getTime() > now.getTime() + MAX_PLAN_AHEAD_MS) {
    return { ok: false, error: `最遠只能排到 ${MAX_PLAN_AHEAD_DAYS} 天後` };
  }

  const venue = raw.venue ?? "other";
  if (!isVenue(venue)) return { ok: false, error: "venue 不在允許清單" };

  const companions = optionalText(raw.companions, "companions", MAX_COMPANIONS_LENGTH);
  if (!companions.ok) return companions;

  const rating = parseRating(raw.rating);
  if (!rating.ok) return rating;
  if (planned && rating.value !== null) return { ok: false, error: "還沒看的場次不能打星" };

  return {
    ok: true,
    value: {
      workId: workId as string | null,
      workTitle: title.value,
      experiencedAt,
      venue,
      companions: companions.value,
      rating: rating.value,
      status: planned ? "planned" : "recorded",
    },
  };
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
}

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 256;

function isShortString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_KEY_LENGTH;
}

/** 瀏覽器 PushSubscription.toJSON() 的形狀；只收 https endpoint */
export function parsePushSubscription(
  body: unknown,
  userAgent: string | null,
): ValidationResult<PushSubscriptionInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "body 必須是 JSON 物件" };
  const raw = body as Record<string, unknown>;
  const endpoint = raw.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return { ok: false, error: "endpoint 格式錯誤" };
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, error: "endpoint 不是有效網址" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "endpoint 必須是 https" };

  const keys = raw.keys as Record<string, unknown> | undefined;
  if (!keys || !isShortString(keys.p256dh) || !isShortString(keys.auth)) {
    return { ok: false, error: "keys.p256dh / keys.auth 缺漏" };
  }
  return {
    ok: true,
    value: {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      userAgent: userAgent ? userAgent.slice(0, 512) : null,
    },
  };
}
