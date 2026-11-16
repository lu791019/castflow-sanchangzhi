import { createAdminClient } from "@/lib/supabase/admin";
import {
  publishContent as enginePublishContent,
  publishScheduledContents as enginePublishScheduledContents,
  type MetaSettings,
  type PublishStore,
} from "@castflow/engine/publish/publish";
import type { Platform } from "@castflow/engine/types";

/**
 * 以 Supabase 實作 engine 的 PublishStore 契約（依賴注入，engine 不碰 DB）
 */
function createSupabasePublishStore(): PublishStore {
  const supabase = createAdminClient();

  return {
    async getContent(contentId) {
      const { data, error } = await supabase
        .from("contents")
        .select("*")
        .eq("id", contentId)
        .single();

      if (error || !data) return null;
      return {
        id: data.id as string,
        platform: data.platform as Platform,
        body: data.body as string,
      };
    },

    async getMetaSettings() {
      const settings: MetaSettings = {};

      const { data: fb } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "meta_facebook")
        .single();
      if (fb?.value) settings.facebook = fb.value as MetaSettings["facebook"];

      const { data: th } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "meta_threads")
        .single();
      if (th?.value) settings.threads = th.value as MetaSettings["threads"];

      return settings;
    },

    async logPublish(entry) {
      await supabase.from("publish_logs").insert(entry);
    },

    async markContentPublished(contentId, success, publishedAt) {
      await supabase
        .from("contents")
        .update({
          status: success ? "published" : "failed",
          published_at: publishedAt,
        })
        .eq("id", contentId);
    },

    async listDueScheduledContentIds(nowIso) {
      const { data } = await supabase
        .from("contents")
        .select("id")
        .eq("status", "scheduled")
        .lte("scheduled_at", nowIso);

      return (data ?? []).map((c) => c.id as string);
    },
  };
}

export async function publishContent(contentId: string) {
  return enginePublishContent(createSupabasePublishStore(), contentId);
}

export async function publishScheduledContents() {
  return enginePublishScheduledContents(createSupabasePublishStore());
}
