import { buildReading } from "@castflow/engine/understand/bilingual";
import { loadDbAiConfig } from "@/lib/anthropic/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GenerateDeps, ReadingRepo } from "./service";
import { createSupabaseReadingRepo } from "./supabase-repo";

export * from "./service";

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_CONCURRENCY = 2;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createReadingRepo(): ReadingRepo {
  return createSupabaseReadingRepo(createAdminClient());
}

/** app 端組裝：Supabase repo + 引擎（AI 設定讀 DB settings，批次大小可由環境變數調） */
export async function createReadingDeps(): Promise<GenerateDeps> {
  const dbConfig = await loadDbAiConfig();
  return {
    repo: createReadingRepo(),
    buildReading,
    engineOptions: {
      batchSize: readPositiveInt(process.env.READING_BATCH_SIZE, DEFAULT_BATCH_SIZE),
      concurrency: readPositiveInt(process.env.READING_CONCURRENCY, DEFAULT_CONCURRENCY),
      llmOptions: { dbConfig },
    },
  };
}
