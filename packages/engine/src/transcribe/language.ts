/**
 * 轉錄語言工具：whisper 不同後端回傳的語言格式不一
 * （Groq verbose_json 給英文全名 "English"，mlx-whisper 給 ISO 碼 "en"），
 * 一律正規化成 ISO 639-1 小寫碼存 DB，下游只需認一種格式。
 */

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  english: "en",
  chinese: "zh",
  mandarin: "zh",
  cantonese: "yue",
  japanese: "ja",
  korean: "ko",
  french: "fr",
  german: "de",
  spanish: "es",
  portuguese: "pt",
  italian: "it",
  russian: "ru",
  arabic: "ar",
  hindi: "hi",
  vietnamese: "vi",
  thai: "th",
  indonesian: "id",
  malay: "ms",
  dutch: "nl",
  turkish: "tr",
};

export const UNKNOWN_LANGUAGE = "unknown";

/** "English" / "en" / "EN" / "zh-TW" → "en" / "en" / "en" / "zh"；無法辨識回 "unknown" */
export function normalizeLanguageCode(raw: unknown): string {
  if (typeof raw !== "string") return UNKNOWN_LANGUAGE;
  const value = raw.trim().toLowerCase();
  if (!value) return UNKNOWN_LANGUAGE;

  const byName = LANGUAGE_NAME_TO_CODE[value];
  if (byName) return byName;

  const base = value.split(/[-_]/)[0];
  if (/^[a-z]{2,3}$/.test(base)) return base;
  return UNKNOWN_LANGUAGE;
}

/** 中文（含 zh-TW、粵語）不需翻譯成繁中對照 */
export function isChineseLanguage(raw: unknown): boolean {
  const code = normalizeLanguageCode(raw);
  return code === "zh" || code === "yue";
}

// CJK 統一表意文字、假名、韓文、全形標點：這些字元之間不需空白
const CJK_CHAR = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/;

function needsSpaceBetween(left: string, right: string): boolean {
  const last = left.slice(-1);
  const first = right.charAt(0);
  if (!last || !first) return false;
  return !CJK_CHAR.test(last) && !CJK_CHAR.test(first);
}

/**
 * 串接分段文字：拉丁語系段落之間補一個空白，CJK 之間直接相接。
 * 避免 "David SangerI cover…" 這種段間黏字。
 */
export function joinSegmentTexts(texts: readonly string[]): string {
  return texts.reduce<string>((joined, raw) => {
    const text = raw.trim();
    if (!text) return joined;
    if (!joined) return text;
    return needsSpaceBetween(joined, text) ? `${joined} ${text}` : `${joined}${text}`;
  }, "");
}
