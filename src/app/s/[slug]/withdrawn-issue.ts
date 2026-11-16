import { createAdminClient } from "@/lib/supabase/admin";
import { issueNumber } from "@/lib/share/article";

const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/** 分享連結曾經存在（slug 對得到集數）但已不公開 → 期號；對不到回 null */
export async function findWithdrawnIssue(slug: string): Promise<string | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[share] findWithdrawnIssue failed", error.message);
    return null;
  }
  return data ? issueNumber(data.id as string) : null;
}
