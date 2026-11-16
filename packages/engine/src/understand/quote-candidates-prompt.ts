/**
 * 引言候選：prompt 與 parser。
 *
 * 契約（同閱讀引擎）：
 * - 輸出格式由 QUOTE_SCHEMA 定義，prompt 只把 schema 交給模型
 * - parser 只綁格式標記 <result>…</result>（extractResultJson），不靠內容長相抓資料
 * - 解析後做 schema 驗證：剛好 3 句、不重複、長度在範圍內、必須是正文原句（防止模型改寫或捏造）
 */

import { extractResultJson, RESULT_CLOSE, RESULT_OPEN } from "./bilingual-prompt";

export const QUOTE_COUNT = 3;
export const QUOTE_MIN_CHARS = 8;
export const QUOTE_MAX_CHARS = 60;

const QUOTE_SCHEMA = `{
  "quotes": ["<候選句 1>", "<候選句 2>", "<候選句 3>"]
}`;

export function buildQuoteCandidatesPrompt(articleText: string): string {
  return `你是雜誌編輯，要從下面這篇第一人稱隨筆裡，挑出 ${QUOTE_COUNT} 句最適合放大當「引言」（pull quote）的句子。

挑選原則：
- 讀者沒看過全文也能被打動：具體的畫面、說不出口的心情、或一句收得很好的體會
- ${QUOTE_COUNT} 句彼此風格要有差異（例如：一句體會、一句畫面、一句小細節），不要挑意思重複的
- 每句 ${QUOTE_MIN_CHARS}–${QUOTE_MAX_CHARS} 字

硬性規則：
- 必須「逐字照抄」正文中的句子或句子片段，不可改寫、不可合併兩句、不可自己補字
- 不要包含外層引號「」

正文：
${articleText}

輸出 schema：
${QUOTE_SCHEMA}

只輸出一個 ${RESULT_OPEN}…${RESULT_CLOSE} 區塊，區塊內是符合 schema 的 JSON，不要其他說明文字。`;
}

/** 去掉外層引號與空白 */
export function normalizeCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/^[「『"“]+/, "")
    .replace(/[」』"”]+$/, "")
    .trim();
}

/** 比對用：去掉空白與標點，只比文字本身（容忍模型把全形/半形標點換掉） */
export function comparableText(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 驗證引言候選：剛好 QUOTE_COUNT 句、正文原句、長度合格、不重複；不合格丟錯交給呼叫端重試 */
export function parseQuoteCandidatesOutput(raw: string, articleText: string): string[] {
  const data = extractResultJson(raw) as { quotes?: unknown };
  if (!Array.isArray(data?.quotes)) {
    throw new Error("引言輸出缺少 quotes 陣列");
  }

  const source = comparableText(articleText);
  const quotes: string[] = [];
  for (const item of data.quotes) {
    if (typeof item !== "string") continue;
    const quote = normalizeCandidate(item);
    const length = Array.from(quote).length;
    if (length < QUOTE_MIN_CHARS || length > QUOTE_MAX_CHARS) continue;
    const key = comparableText(quote);
    if (!key || !source.includes(key)) continue;
    if (quotes.some((existing) => comparableText(existing) === key)) continue;
    quotes.push(quote);
  }

  if (quotes.length < QUOTE_COUNT) {
    throw new Error(`引言候選只有 ${quotes.length} 句合格（需 ${QUOTE_COUNT} 句、且須為正文原句）`);
  }
  return quotes.slice(0, QUOTE_COUNT);
}
