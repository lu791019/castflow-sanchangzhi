/**
 * 閱讀引擎的 prompt 與 parser。
 *
 * 契約設計：
 * - 輸出格式由「schema」定義（TRANSLATION_SCHEMA / OVERVIEW_SCHEMA），prompt 只負責把 schema 交給模型
 * - parser 只綁格式標記 <result>…</result>，標記內是 JSON；不靠內容長相（如「第一個大括號」）抓資料
 * - 解析後一律做 schema 驗證，不合格就丟錯，交給呼叫端重試
 */

import type { Chapter, SummaryPoint } from "../types";

export const RESULT_OPEN = "<result>";
export const RESULT_CLOSE = "</result>";

export interface TranslationInput {
  id: number;
  text: string;
}

export interface TranslationOutput {
  id: number;
  zh: string;
}

export interface OverviewOutput {
  summary: SummaryPoint[];
  chapters: Chapter[];
}

export const SUMMARY_MIN = 3;
export const SUMMARY_MAX = 5;

const TRANSLATION_SCHEMA = `{
  "translations": [
    { "id": <number，對應輸入段落 id>, "zh": "<該段的繁體中文翻譯>" }
  ]
}`;

const OVERVIEW_SCHEMA = `{
  "summary": [
    { "text": "<重點 1>", "start": <number，這個重點在逐字稿中開始被談到的秒數，取自逐字稿行首的秒數> }
  ],
  "chapters": [
    { "title": "<章節標題>", "start": <number，章節起始秒數，取自逐字稿行首的秒數> }
  ]
}`;

const OUTPUT_RULE = `只輸出一個 ${RESULT_OPEN}…${RESULT_CLOSE} 區塊，區塊內是符合 schema 的 JSON，不要其他說明文字。`;

function formatContext(context: readonly string[]): string {
  if (!context.length) return "";
  return `\n前文（僅供理解語境，不要翻譯）：\n${context.map((t) => `> ${t}`).join("\n")}\n`;
}

/** 翻譯一批段落：段落以 id 標記，輸出必須逐 id 對應 */
export function buildTranslationPrompt(
  items: readonly TranslationInput[],
  sourceLang: string,
  context: readonly string[] = [],
): string {
  const lines = items.map((item) => JSON.stringify({ id: item.id, text: item.text }));
  return `你是專業的 podcast 逐字稿譯者。把下列「${sourceLang}」逐字稿段落翻成自然流暢的台灣繁體中文。

規則：
- 每個輸入段落都要有一筆對應翻譯，id 必須一一對應，不可合併、拆分或遺漏
- 段落是口語斷句，可能在句子中間斷開；依前後文翻出該段對應的意思即可
- 人名、品牌、節目名第一次出現可保留原文；專有名詞用台灣慣用譯名
- 使用繁體中文與全形標點，不要簡體字
${formatContext(context)}
輸入段落（每行一個 JSON）：
${lines.join("\n")}

輸出 schema：
${TRANSLATION_SCHEMA}

${OUTPUT_RULE}`;
}

/** 摘要 + 章節：輸入為「[秒數] 文字」的時間軸逐字稿 */
export function buildOverviewPrompt(
  timeline: string,
  sourceLang: string,
  durationSeconds: number,
): string {
  return `你是 podcast 編輯。閱讀下列「${sourceLang}」逐字稿（每行開頭的 [數字] 是該行起始秒數，全長約 ${Math.round(durationSeconds)} 秒），用台灣繁體中文產出：

1. summary：${SUMMARY_MIN}–${SUMMARY_MAX} 條重點摘要，每條一句話、具體（帶出人物、主張或數據），不要空泛；每條附 start＝該重點開始被談到的秒數（取自逐字稿行首的秒數），依時間遞增
2. chapters：依話題轉換切章節，每章一個簡短標題（15 字內）與起始秒數；start 必須取自逐字稿行首的秒數，第一章從 0 開始，依時間遞增

逐字稿：
${timeline}

輸出 schema：
${OVERVIEW_SCHEMA}

${OUTPUT_RULE}`;
}

/** 取出最後一組 <result>…</result> 內的 JSON（容忍區塊內的 ```json 圍欄） */
export function extractResultJson(raw: string): unknown {
  const close = raw.lastIndexOf(RESULT_CLOSE);
  const open = close === -1 ? -1 : raw.lastIndexOf(RESULT_OPEN, close);
  if (open === -1 || close === -1) {
    throw new Error(`LLM 輸出缺少 ${RESULT_OPEN}…${RESULT_CLOSE} 格式標記`);
  }
  const body = raw
    .slice(open + RESULT_OPEN.length, close)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("LLM 輸出的 <result> 區塊不是合法 JSON");
  }
}

/** 驗證翻譯輸出：每個期望 id 都要有非空譯文；多餘 id 忽略 */
export function parseTranslationOutput(
  raw: string,
  expectedIds: readonly number[],
): Map<number, string> {
  const data = extractResultJson(raw) as { translations?: unknown };
  if (!Array.isArray(data?.translations)) {
    throw new Error("翻譯輸出缺少 translations 陣列");
  }

  const byId = new Map<number, string>();
  for (const item of data.translations) {
    const entry = item as Partial<TranslationOutput> | null;
    if (entry && typeof entry.id === "number" && typeof entry.zh === "string" && entry.zh.trim()) {
      byId.set(entry.id, entry.zh.trim());
    }
  }

  const missing = expectedIds.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new Error(`翻譯輸出缺少段落 id：${missing.join(", ")}`);
  }
  return new Map(expectedIds.map((id) => [id, byId.get(id) as string]));
}

/**
 * 驗證摘要與章節：
 * - summary 每條帶時間戳（見 parseSummaryPoints），至少 SUMMARY_MIN 條，超過 SUMMARY_MAX 截斷
 * - chapters 過濾無效項、依時間排序、同起點去重；起點吸附到最近的段落起點
 */
export function parseOverviewOutput(
  raw: string,
  segmentStarts: readonly number[],
): OverviewOutput {
  const data = extractResultJson(raw) as { summary?: unknown; chapters?: unknown };

  const summary = parseSummaryPoints(data?.summary, segmentStarts);
  if (summary.length < SUMMARY_MIN) {
    throw new Error(`有效摘要（含時間戳）只有 ${summary.length} 條，至少需要 ${SUMMARY_MIN} 條`);
  }

  const rawChapters = Array.isArray(data?.chapters) ? data.chapters : [];
  const snapped = rawChapters
    .map((item) => item as Partial<Chapter> | null)
    .filter(
      (c): c is Chapter =>
        !!c &&
        typeof c.title === "string" &&
        c.title.trim().length > 0 &&
        isValidStart(c.start),
    )
    .map((c) => ({ title: c.title.trim(), start: snapToSegmentStart(c.start, segmentStarts) }))
    .sort((a, b) => a.start - b.start);

  const chapters = snapped.filter((c, i) => i === 0 || c.start !== snapped[i - 1].start);
  if (!chapters.length) {
    throw new Error("章節輸出為空");
  }

  return { summary: summary.slice(0, SUMMARY_MAX), chapters };
}

function isValidStart(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * 摘要 schema：每條必須是 {text: 非空字串, start: ≥0 的秒數}。
 * 舊格式（純字串）與缺時間戳的條目一律視為無效，不足最少條數時丟錯交給重試。
 * 起點吸附到段落起點，依時間排序（同時間保留模型給的先後）。
 */
export function parseSummaryPoints(
  value: unknown,
  segmentStarts: readonly number[],
): SummaryPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<SummaryPoint> | null)
    .filter(
      (item): item is SummaryPoint =>
        !!item &&
        typeof item === "object" &&
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        isValidStart(item.start),
    )
    .map((item) => ({ text: item.text.trim(), start: snapToSegmentStart(item.start, segmentStarts) }))
    .sort((a, b) => a.start - b.start);
}

/** 吸附到最接近的段落起點，讓閱讀頁點章節能精準跳到某段 */
export function snapToSegmentStart(seconds: number, segmentStarts: readonly number[]): number {
  if (!segmentStarts.length) return seconds;
  return segmentStarts.reduce((best, start) =>
    Math.abs(start - seconds) < Math.abs(best - seconds) ? start : best,
  );
}
