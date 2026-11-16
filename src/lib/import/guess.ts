/**
 * 對作品（LLM）：從標題與前段正文判斷「這篇在談哪部作品、類型、年份」。
 * 契約同引擎其他 LLM 呼叫：schema 交給模型、parser 只綁 <result>…</result> 格式標記、欄位逐一驗證，
 * 不合格整次重試；兩次都失敗丟錯，由呼叫端推警報並改讓使用者手動搜尋（不自動定作品）。
 */

import { extractResultJson, RESULT_CLOSE, RESULT_OPEN } from "@castflow/engine/understand/bilingual-prompt";
import type { ArticleBlock } from "@/lib/share/article";

export const GUESS_KINDS = ["movie", "series", "podcast", "live", "exhibition", "unknown"] as const;
export type GuessKind = (typeof GUESS_KINDS)[number];

export interface WorkGuess {
  title: string | null;
  originalTitle: string | null;
  kind: GuessKind;
  year: number | null;
}

export type GuessLlm = (prompt: string) => Promise<string>;

export const GUESS_LEAD_CHARS = 1200;
export const GUESS_ATTEMPTS = 2;
const MIN_YEAR = 1880;
const MAX_YEAR = 2100;
const MAX_TITLE = 120;

const GUESS_SCHEMA = `{
  "title": "<作品的台灣通行中文名稱；判斷不出來填 null>",
  "originalTitle": "<原文名稱；沒有或不確定填 null>",
  "kind": "<movie | series | podcast | live | exhibition | unknown 其中之一>",
  "year": <作品首映／首播／演出年份（西元整數）；不確定填 null>
}`;

/** 給模型看的前段正文：段落接起來取前 GUESS_LEAD_CHARS 字 */
export function guessLead(blocks: readonly ArticleBlock[]): string {
  const text = blocks.map((block) => (block.type === "list" ? block.items.join("、") : block.text)).join("\n");
  return Array.from(text).slice(0, GUESS_LEAD_CHARS).join("");
}

export function buildGuessPrompt(title: string, lead: string): string {
  return `下面是一篇部落格文章的標題與開頭。判斷這篇主要在談哪一部作品（電影、影集、Podcast、演出或展覽）。

標題：${title}

開頭：
${lead}

輸出 schema：
${GUESS_SCHEMA}

${RESULT_OPEN}…${RESULT_CLOSE} 區塊內只放符合 schema 的 JSON。`;
}

function optionalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`作品判斷輸出的 ${field} 不是字串`);
  const text = value.trim();
  return text ? Array.from(text).slice(0, MAX_TITLE).join("") : null;
}

function parseYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const year = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof year !== "number" || !Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error("作品判斷輸出的 year 不合理");
  }
  return year;
}

function parseKind(value: unknown): GuessKind {
  if (typeof value === "string" && (GUESS_KINDS as readonly string[]).includes(value)) return value as GuessKind;
  throw new Error("作品判斷輸出的 kind 不在 schema 內");
}

export function parseGuessOutput(raw: string): WorkGuess {
  const data = extractResultJson(raw) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") throw new Error("作品判斷輸出不是物件");
  const title = optionalText(data.title, "title");
  const kind = parseKind(data.kind);
  return {
    title,
    originalTitle: optionalText(data.originalTitle, "originalTitle"),
    kind: title ? kind : "unknown",
    year: parseYear(data.year),
  };
}

export async function guessWork(input: { title: string; lead: string }, llm: GuessLlm): Promise<WorkGuess> {
  const prompt = buildGuessPrompt(input.title, input.lead);
  let lastError: unknown;
  for (let attempt = 1; attempt <= GUESS_ATTEMPTS; attempt++) {
    try {
      return parseGuessOutput(await llm(prompt));
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`判斷作品失敗（嘗試 ${GUESS_ATTEMPTS} 次）：${detail}`);
}
