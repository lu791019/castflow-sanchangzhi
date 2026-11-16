import {
  generateAllPlatforms as engineGenerateAllPlatforms,
  generateSinglePlatform as engineGenerateSinglePlatform,
} from "@castflow/engine/generate/generate-content";
import type { Platform, StyleDimensions } from "@castflow/engine/types";
import { getServerNotify } from "@/lib/alerts/notify";
import { loadDbAiConfig } from "./client";

export async function generateAllPlatforms(
  transcript: string,
  styleDna?: StyleDimensions,
): Promise<Record<Platform, string>> {
  return engineGenerateAllPlatforms(transcript, styleDna, {
    dbConfig: await loadDbAiConfig(),
    notify: getServerNotify(),
  });
}

export async function generateSinglePlatform(
  transcript: string,
  platform: Platform,
  styleDna?: StyleDimensions,
): Promise<string> {
  return engineGenerateSinglePlatform(transcript, platform, styleDna, {
    dbConfig: await loadDbAiConfig(),
    notify: getServerNotify(),
  });
}
