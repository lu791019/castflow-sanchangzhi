import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_PLATFORMS } from "@/lib/prompts/generate-content";
import type { EpisodePatch, ProofEpisodeRecord, ProofRepo } from "./service";

/** 校樣的社群草稿（6 平台扣 blog） */
const SOCIAL_DRAFT_PLATFORMS = ALL_PLATFORMS.filter((platform) => platform !== "blog");

/**
 * ProofRepo 的 Supabase 實作。
 * ownerId：限定只讀寫該使用者的集數，「作者已發佈篇數」也只算這位作者。
 * 不傳時不過濾（不分使用者的情境）。
 */
export function createSupabaseProofRepo(supabase: SupabaseClient, ownerId?: string): ProofRepo {
  return {
    async getEpisode(id) {
      const { data, error } = await supabase
        .from("episodes")
        .select("id, source, work_id, share_slug, published_at")
        .eq("id", id)
        .match(ownerId ? { user_id: ownerId } : {})
        .maybeSingle();
      if (error) throw new Error(`讀取集數失敗：${error.message}`);
      return (data as ProofEpisodeRecord | null) ?? null;
    },

    async slugExists(slug) {
      const { count, error } = await supabase
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .eq("share_slug", slug);
      if (error) throw new Error(`檢查文章連結失敗：${error.message}`);
      return (count ?? 0) > 0;
    },

    async updateEpisode(id, patch: EpisodePatch) {
      const { error } = await supabase
        .from("episodes")
        .update(patch)
        .eq("id", id)
        .match(ownerId ? { user_id: ownerId } : {});
      if (error) throw new Error(`更新集數失敗：${error.message}`);
    },

    async countListedWorkFeelings(workId, excludeId, publishedUpTo) {
      let query = supabase
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId)
        .eq("visibility", "public")
        .not("share_slug", "is", null)
        .not("published_at", "is", null)
        .neq("source", "rss")
        .neq("id", excludeId);
      if (publishedUpTo) query = query.lte("published_at", publishedUpTo);
      const { count, error } = await query;
      if (error) throw new Error(`計算特輯段數失敗：${error.message}`);
      return count ?? 0;
    },

    async countAuthorPublished(excludeId, publishedUpTo) {
      let query = supabase
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .match(ownerId ? { user_id: ownerId } : {})
        .not("published_at", "is", null)
        .neq("source", "rss")
        .neq("id", excludeId);
      if (publishedUpTo) query = query.lte("published_at", publishedUpTo);
      const { count, error } = await query;
      if (error) throw new Error(`計算發佈篇數失敗：${error.message}`);
      return count ?? 0;
    },

    async deleteSocialDrafts(episodeId) {
      const { error } = await supabase
        .from("contents")
        .delete()
        .eq("episode_id", episodeId)
        .match(ownerId ? { user_id: ownerId } : {})
        // 只清校樣的社群平台；「看完了」的 Threads 貼文與長文（threads_post／longform）不在這裡
        .in("platform", SOCIAL_DRAFT_PLATFORMS)
        .eq("status", "draft");
      if (error) throw new Error(`清除社群草稿失敗：${error.message}`);
    },

    async getBlogBody(episodeId) {
      const { data, error } = await supabase
        .from("contents")
        .select("body")
        .eq("episode_id", episodeId)
        .eq("platform", "blog")
        .match(ownerId ? { user_id: ownerId } : {})
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`讀取正文失敗：${error.message}`);
      return (data?.body as string | undefined) ?? null;
    },
  };
}
