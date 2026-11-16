/**
 * 語氣樣本（Q-75、Q-79～Q-81）：每人一份，只拿來學本人的語氣。
 * paste＝自己貼的貼文、spoken＝在散場誌說一段的原話；AI 產出的貼文一律不收（語料不收 AI 稿）。
 * 純函式：驗證與挑選；存取在 repository.ts。
 */

export const VOICE_SOURCES = ["paste", "spoken", "threads_api"] as const;
export type VoiceSource = (typeof VOICE_SOURCES)[number];

/** 自己貼的最多 10 篇（Q-79：3～10 篇） */
export const MAX_PASTED_SAMPLES = 10;
/** 少於 3 篇會提示「再貼幾篇會更像你」 */
export const SUGGESTED_MIN_SAMPLES = 3;
/** 太短學不到語氣（一句「好看」不算） */
export const MIN_SAMPLE_CHARS = 20;
export const MAX_SAMPLE_CHARS = 5000;
/** 生成時帶幾篇全文（全域規則：2～3 篇真跡＋少量規則） */
export const PROMPT_SAMPLE_COUNT = 3;
/** 帶進 prompt 的樣本總字數上限，避免一篇長文吃光 context */
export const PROMPT_SAMPLE_CHAR_BUDGET = 3000;

export interface VoiceSample {
  id: string;
  body: string;
  source: VoiceSource;
  created_at: string;
}

export type SampleResult = { ok: true; value: string } | { ok: false; error: string };

export function parsePastedSample(value: unknown): SampleResult {
  if (typeof value !== "string") return { ok: false, error: "請貼上文字" };
  const body = value.trim();
  const length = Array.from(body).length;
  if (length < MIN_SAMPLE_CHARS) return { ok: false, error: `太短了，至少 ${MIN_SAMPLE_CHARS} 字才學得到語氣` };
  if (length > MAX_SAMPLE_CHARS) return { ok: false, error: `太長了，一篇最多 ${MAX_SAMPLE_CHARS} 字` };
  return { ok: true, value: body };
}

/** 說一段的原話夠長才收（太短的錄音本來就不整理，見 say/meaningful） */
export function isUsableSpokenSample(text: string): boolean {
  return Array.from(text.trim()).length >= MIN_SAMPLE_CHARS;
}

/**
 * 挑要帶進 prompt 的樣本：自己貼的優先（是寫給人看的文字，最接近要產的貼文），再補說過的原話；
 * 同來源新的先；總字數超過預算就停（第一篇一定收，過長截到預算）。
 */
export function pickPromptSamples(
  samples: readonly VoiceSample[],
  count: number = PROMPT_SAMPLE_COUNT,
  budget: number = PROMPT_SAMPLE_CHAR_BUDGET,
): string[] {
  const rank = (s: VoiceSample) => (s.source === "spoken" ? 1 : 0);
  const ordered = [...samples].sort(
    (a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at),
  );
  const picked: string[] = [];
  let used = 0;
  for (const sample of ordered) {
    if (picked.length >= count) break;
    const chars = Array.from(sample.body);
    if (picked.length === 0 && chars.length > budget) {
      picked.push(chars.slice(0, budget).join(""));
      break;
    }
    if (used + chars.length > budget) continue;
    picked.push(sample.body);
    used += chars.length;
  }
  return picked;
}
