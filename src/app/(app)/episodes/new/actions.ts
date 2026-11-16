"use server";

import {
  ingestText,
  validateTextIngestInput,
  TextIngestGenerationError,
} from "@/lib/ingest/text";
import {
  listFeeds,
  subscribeRss,
  validateFeedUrl,
  type SubscribedFeed,
} from "@/lib/ingest/rss";
import { RssIngestError } from "@/lib/ingest/rss-errors";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";

export async function ingestTextAction(input: {
  title: string;
  text: string;
  workId?: string | null;
  journalId?: string | null;
}) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  const validationError = validateTextIngestInput(input);
  if (validationError) {
    return { error: validationError };
  }

  try {
    const { episodeId } = await ingestText(userId, input);
    return { success: true, episodeId };
  } catch (error) {
    // 生成失敗但 episode 已建立：帶回 episodeId，前端導去既有頁面重試生成
    if (error instanceof TextIngestGenerationError) {
      return {
        error: `文案生成失敗：${error.message}`,
        episodeId: error.episodeId,
      };
    }
    const message = error instanceof Error ? error.message : "文字匯入失敗";
    return { error: message };
  }
}

export async function subscribeRssAction(input: { feedUrl: string }) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  const validationError = validateFeedUrl(input);
  if (validationError) {
    return { error: validationError };
  }

  try {
    const result = await subscribeRss(userId, input.feedUrl);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof RssIngestError) {
      return { error: error.message, code: error.code };
    }
    const message = error instanceof Error ? error.message : "RSS 訂閱失敗";
    return { error: message };
  }
}

export async function listFeedsAction(): Promise<{
  feeds: Array<SubscribedFeed & { created_at: string }>;
  error?: string;
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { feeds: [], error: UNAUTHORIZED_MESSAGE };
  try {
    return { feeds: await listFeeds(userId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取 feeds 失敗";
    return { feeds: [], error: message };
  }
}
