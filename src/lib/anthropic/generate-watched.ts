import {
  generateWatchedLongform as engineGenerateWatchedLongform,
  generateWatchedThreads as engineGenerateWatchedThreads,
} from "@castflow/engine/generate/watched";
import type { WatchedPromptInput } from "@castflow/engine/generate/watched-prompt";
import { getServerNotify } from "@/lib/alerts/notify";
import { loadDbAiConfig } from "./client";

export async function generateWatchedThreads(input: WatchedPromptInput): Promise<string> {
  return engineGenerateWatchedThreads(input, { dbConfig: await loadDbAiConfig(), notify: getServerNotify() });
}

export async function generateWatchedLongform(input: WatchedPromptInput): Promise<string> {
  return engineGenerateWatchedLongform(input, { dbConfig: await loadDbAiConfig(), notify: getServerNotify() });
}
