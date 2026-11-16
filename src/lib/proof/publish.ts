/** 校樣發佈設定：公開範圍、署名、錄下時刻、序數與 slug 的純邏輯 */

export type Visibility = "public" | "unlisted" | "private";
export type Byline = "pen_name" | "anonymous";

export const VISIBILITIES: readonly Visibility[] = ["public", "unlisted", "private"];
export const BYLINES: readonly Byline[] = ["pen_name", "anonymous"];

export const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: Visibility;
  label: string;
  note: string;
}> = [
  { value: "public", label: "公開", note: "會出現在今晚的目錄與作品特輯" },
  { value: "unlisted", label: "只給有連結的人", note: "不會出現在目錄裡" },
  { value: "private", label: "私人", note: "只存在我的專欄" },
];

export const ANONYMOUS_NAME = "匿名";
export const DEFAULT_PEN_NAME = "作者";

export function parseVisibility(value: unknown): Visibility | null {
  return typeof value === "string" && (VISIBILITIES as readonly string[]).includes(value)
    ? (value as Visibility)
    : null;
}

export function parseByline(value: unknown): Byline | null {
  return typeof value === "string" && (BYLINES as readonly string[]).includes(value)
    ? (value as Byline)
    : null;
}

/** 只有「公開」會進今晚的目錄與作品特輯 */
export function isListed(visibility: Visibility): boolean {
  return visibility === "public";
}

/** 私人文章不開放分享頁 */
export function isShareable(visibility: Visibility): boolean {
  return visibility !== "private";
}

export function displayAuthor(byline: Byline, penName: string): string {
  if (byline === "anonymous") return ANONYMOUS_NAME;
  return penName.trim() || DEFAULT_PEN_NAME;
}

/** settings.author_profile.pen_name → 筆名；讀不到用預設值 */
export function penNameFromSetting(value: unknown): string {
  if (typeof value !== "object" || value === null) return DEFAULT_PEN_NAME;
  const raw = (value as Record<string, unknown>).pen_name;
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 30) : DEFAULT_PEN_NAME;
}

/**
 * 「錄下」時刻標籤（單一出口）。
 * 設計稿原為「散場後 N 分鐘錄下」，但系統不知道使用者何時看完，
 * 暫以錄音/送出時刻呈現：10.07 22:41 錄下（用打的：寫下）。
 * TODO(recorded-at): 之後有「散場時間」資料時，只改這裡。
 */
export const RECORDED_AT_TIMEZONE = "Asia/Taipei";

export function recordedAtLabel(iso: string, source: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RECORDED_AT_TIMEZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const verb = source === "text" ? "寫下" : "錄下";
  return `${pick("month")}.${pick("day")} ${pick("hour")}:${pick("minute")} ${verb}`;
}

/** 錄音長度：2 分 14 秒；未知或 0 回傳 null（不顯示） */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest} 秒`;
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`;
}

/** 由逐字稿分段推算長度（取最大 end） */
export function durationFromSegments(segments: unknown): number | null {
  if (!Array.isArray(segments)) return null;
  const ends = segments
    .map((segment) => (segment as { end?: unknown } | null)?.end)
    .filter((end): end is number => typeof end === "number" && Number.isFinite(end));
  const max = ends.length ? Math.max(...ends) : 0;
  return max > 0 ? max : null;
}

/** 下一個序數：已有 count 筆（不含自己）→ 自己是第 count+1 */
export function nextOrdinal(existingCount: number): number {
  return Math.max(0, Math.floor(existingCount)) + 1;
}

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const SHARE_SLUG_LENGTH = 10;

/** 分享頁 slug：小寫英數（去掉易混字），符合 /s/[slug] 的格式檢查 */
export function generateShareSlug(random: (size: number) => Uint8Array): string {
  const bytes = random(SHARE_SLUG_LENGTH);
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join("");
}

export const MAX_QUOTE_LENGTH = 120;

/** 選定引言：去引號空白；空字串視為未選；過長拒絕 */
export function normalizePickedQuote(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return "invalid";
  const quote = value
    .trim()
    .replace(/^[「『"“]+/, "")
    .replace(/[」』"”]+$/, "")
    .trim();
  if (!quote) return null;
  return Array.from(quote).length > MAX_QUOTE_LENGTH ? "invalid" : quote;
}

/** 已存的候選句（jsonb）→ 字串陣列；格式不對回傳空陣列 */
export function parseStoredCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
