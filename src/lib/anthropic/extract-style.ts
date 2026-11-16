import { extractStyleDna as engineExtractStyleDna } from "@castflow/engine/style/extract-style";
import type { StyleDimensions } from "@castflow/engine/types";
import { loadDbAiConfig } from "./client";

export async function extractStyleDna(
  platform: string,
  examples: { content: string; likes?: number; comments?: number; shares?: number }[],
  customDimensionNames?: string[],
): Promise<StyleDimensions> {
  return engineExtractStyleDna(platform, examples, customDimensionNames, {
    dbConfig: await loadDbAiConfig(),
  });
}
