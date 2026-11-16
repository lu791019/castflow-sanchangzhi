import { createAdminClient } from "@/lib/supabase/admin";
import {
  runClaudePrint as engineRunClaudePrint,
  type AiConfig,
} from "@castflow/engine/llm/client";

export type { AiConfig };

/**
 * 從 DB settings 讀取 ai_config，以依賴注入方式交給 engine
 * （engine 為純函式層，不碰 Supabase）
 */
export async function loadDbAiConfig(): Promise<AiConfig | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "ai_config")
    .single();

  return (data?.value as AiConfig | null) ?? null;
}

export async function runClaudePrint(prompt: string): Promise<string> {
  return engineRunClaudePrint(prompt, { dbConfig: await loadDbAiConfig() });
}
