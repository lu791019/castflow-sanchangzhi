/** 播放同步與引用：純邏輯（client 元件與測試共用） */

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const SKIP_SECONDS = 15;

/** 引用帶到 /say 的長度上限（網址不要無限長；一句話足夠） */
export const QUOTE_MAX_LENGTH = 200;

/** 依播放時間找目前段落／章節：最後一個 start ≤ t 的索引；t 早於第一段回 -1 */
export function activeIndexAt(starts: readonly number[], time: number): number {
  if (!starts.length || !Number.isFinite(time) || time < starts[0]) return -1;
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (starts[mid] <= time) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** ±15 秒跳轉，夾在 [0, duration]（duration 未知時只夾下限） */
export function skipTime(current: number, delta: number, duration: number | null): number {
  const next = Math.max(0, current + delta);
  return duration && Number.isFinite(duration) ? Math.min(next, duration) : next;
}

/** 倍速循環：1 → 1.25 → 1.5 → 2 → 1 */
export function nextPlaybackRate(rate: number): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(rate as PlaybackRate);
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
}

export function formatRate(rate: number): string {
  return `${rate}×`;
}

/** 選取文字整理：壓縮空白、去頭尾引號，過長截斷加「…」；空字串回 null */
export function normalizeQuote(raw: string): string | null {
  const text = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[「『"“]+|[」』"”]+$/g, "")
    .trim();
  if (!text) return null;
  return text.length > QUOTE_MAX_LENGTH ? `${text.slice(0, QUOTE_MAX_LENGTH - 1)}…` : text;
}

/**
 * 引用到我的感受：/say?work=<slug>&quote=<句子>（沒綁作品就只帶 quote）。
 */
export function buildQuoteHref(workSlug: string | null, quote: string): string {
  const params = new URLSearchParams();
  if (workSlug) params.set("work", workSlug);
  params.set("quote", quote);
  return `/say?${params.toString()}`;
}

/** 聽完了？說一段：帶入這一集的作品 */
export function buildSayHref(workSlug: string | null): string {
  return workSlug ? `/say?work=${encodeURIComponent(workSlug)}` : "/say";
}
