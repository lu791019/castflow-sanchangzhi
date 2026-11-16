/**
 * 引言候選引擎：從整理好的正文挑 3 句候選引言（LLM）。
 * - 引擎不碰 DB；LLM 呼叫可注入（測試用 mock、app 用 DB 設定）
 * - 輸出走 schema 驗證，不合格整次重試（maxAttempts）
 */

import { runClaudePrint, type RunClaudePrintOptions } from "../llm/client";
import { buildQuoteCandidatesPrompt, parseQuoteCandidatesOutput } from "./quote-candidates-prompt";

export type QuoteLlmCall = (prompt: string) => Promise<string>;

export interface QuoteCandidatesOptions {
  maxAttempts?: number;
  llm?: QuoteLlmCall;
  llmOptions?: RunClaudePrintOptions;
}

export const DEFAULT_QUOTE_ATTEMPTS = 2;

export async function pickQuoteCandidates(
  articleText: string,
  options: QuoteCandidatesOptions = {},
): Promise<string[]> {
  const text = articleText.trim();
  if (!text) throw new Error("正文是空的，無法挑選引言");

  const llm = options.llm ?? ((prompt: string) => runClaudePrint(prompt, options.llmOptions));
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_QUOTE_ATTEMPTS);
  const prompt = buildQuoteCandidatesPrompt(text);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return parseQuoteCandidatesOutput(await llm(prompt), text);
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`挑選引言候選失敗（嘗試 ${maxAttempts} 次）：${detail}`);
}
