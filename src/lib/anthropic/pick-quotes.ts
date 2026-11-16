import { pickQuoteCandidates as enginePickQuoteCandidates } from "@castflow/engine/understand/quote-candidates";
import { loadDbAiConfig } from "./client";

/** 從正文挑 3 句候選引言（engine 薄殼：注入 DB 的 AI 設定） */
export async function pickQuoteCandidates(articleText: string): Promise<string[]> {
  return enginePickQuoteCandidates(articleText, {
    llmOptions: { dbConfig: await loadDbAiConfig() },
  });
}
