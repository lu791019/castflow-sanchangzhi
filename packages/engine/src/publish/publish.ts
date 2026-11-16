import { publishToFacebook } from "./facebook";
import { publishToThreads } from "./threads";
import { Platform } from "../types";

export interface MetaSettings {
  facebook?: { page_id: string; page_access_token: string };
  threads?: { user_id: string; access_token: string };
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface PublishableContent {
  id: string;
  platform: Platform;
  body: string;
}

export interface PublishLogEntry {
  content_id: string;
  platform: Platform;
  platform_post_id: string | null;
  response: Record<string, unknown>;
  status: "success" | "failed";
  error_message: string | null;
}

/**
 * 儲存層介面：由呼叫端（app / worker）注入實作。
 * engine 不知道 Supabase，只透過這組純函式契約讀寫。
 */
export interface PublishStore {
  getContent(contentId: string): Promise<PublishableContent | null>;
  getMetaSettings(): Promise<MetaSettings>;
  logPublish(entry: PublishLogEntry): Promise<void>;
  markContentPublished(
    contentId: string,
    success: boolean,
    publishedAt: string | null,
  ): Promise<void>;
  listDueScheduledContentIds(nowIso: string): Promise<string[]>;
}

export async function publishContent(
  store: PublishStore,
  contentId: string,
): Promise<PublishResult> {
  const content = await store.getContent(contentId);

  if (!content) {
    return { success: false, error: "Content not found" };
  }

  const platform = content.platform;
  const meta = await store.getMetaSettings();

  let result: PublishResult;

  if (platform === "facebook") {
    if (!meta.facebook?.page_id || !meta.facebook?.page_access_token) {
      return { success: false, error: "Facebook 尚未連結，請至 Settings 設定" };
    }
    result = await publishToFacebook(
      {
        pageId: meta.facebook.page_id,
        pageAccessToken: meta.facebook.page_access_token,
      },
      content.body,
    );
  } else if (platform === "threads") {
    if (!meta.threads?.user_id || !meta.threads?.access_token) {
      return { success: false, error: "Threads 尚未連結，請至 Settings 設定" };
    }
    result = await publishToThreads(
      {
        userId: meta.threads.user_id,
        accessToken: meta.threads.access_token,
      },
      content.body,
    );
  } else {
    return {
      success: false,
      error: `平台 ${platform} 不支援直接發布，請使用複製功能手動發布`,
    };
  }

  // Log the publish attempt
  await store.logPublish({
    content_id: contentId,
    platform,
    platform_post_id: result.postId || null,
    response: result as unknown as Record<string, unknown>,
    status: result.success ? "success" : "failed",
    error_message: result.error || null,
  });

  // Update content status
  await store.markContentPublished(
    contentId,
    result.success,
    result.success ? new Date().toISOString() : null,
  );

  return result;
}

export async function publishScheduledContents(store: PublishStore) {
  const dueContentIds = await store.listDueScheduledContentIds(
    new Date().toISOString(),
  );

  if (dueContentIds.length === 0) {
    return { published: 0, failed: 0 };
  }

  let published = 0;
  let failed = 0;

  for (const contentId of dueContentIds) {
    const result = await publishContent(store, contentId);
    if (result.success) published++;
    else failed++;
  }

  return { published, failed };
}
