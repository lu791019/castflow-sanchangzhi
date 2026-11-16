import { runClaudePrint, type RunClaudePrintOptions } from "../llm/client";
import { buildAnalyzeEditPrompt } from "./analyze-edit-prompt";

export interface StyleSuggestion {
  dimension: string;
  original: string;
  suggested: string;
  reason: string;
}

export async function analyzeEditDiff(
  platform: string,
  originalBody: string,
  editedBody: string,
  options?: RunClaudePrintOptions,
): Promise<StyleSuggestion[]> {
  if (originalBody === editedBody) {
    return [];
  }

  const prompt = buildAnalyzeEditPrompt(platform, originalBody, editedBody);
  const text = await runClaudePrint(prompt, options);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse edit analysis: no JSON array found");
  }

  const parsed = JSON.parse(jsonMatch[0]) as StyleSuggestion[];
  return parsed;
}
