/** 文章頁「原文刊於」：讀匯入文章的原文網址（service role；只回 https 網址，否則 null） */

import { createAdminClient } from "@/lib/supabase/admin";

export async function loadOriginalUrl(episodeId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("episodes").select("original_url").eq("id", episodeId).maybeSingle();
  if (error) {
    console.error("[import] 讀取原文網址失敗", { episodeId, message: error.message });
    return null;
  }
  const url = (data?.original_url as string | null | undefined) ?? null;
  return url?.startsWith("https://") ? url : null;
}
