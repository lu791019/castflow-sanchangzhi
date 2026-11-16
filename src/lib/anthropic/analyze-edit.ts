import { analyzeEditDiff as engineAnalyzeEditDiff } from "@castflow/engine/style/analyze-edit";
import type { StyleSuggestion } from "@castflow/engine/style/analyze-edit";
import { loadDbAiConfig } from "./client";

export type { StyleSuggestion };

export async function analyzeEditDiff(
  platform: string,
  originalBody: string,
  editedBody: string,
): Promise<StyleSuggestion[]> {
  return engineAnalyzeEditDiff(platform, originalBody, editedBody, {
    dbConfig: await loadDbAiConfig(),
  });
}
