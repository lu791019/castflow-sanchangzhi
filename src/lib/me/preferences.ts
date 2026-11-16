/** 我的 › 設定：發佈預設值（migration 019，profiles.default_visibility / generate_social），只經 server 寫入 */

import { createAdminClient } from "@/lib/supabase/admin";
import { parseVisibility, type Visibility } from "@/lib/proof/publish";

export interface PublishDefaults {
  defaultVisibility: Visibility;
  generateSocial: boolean;
}

export const DEFAULT_PUBLISH_DEFAULTS: PublishDefaults = { defaultVisibility: "public", generateSocial: true };

export async function getPublishDefaults(userId: string): Promise<PublishDefaults> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("default_visibility, generate_social")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`讀取發佈預設失敗：${error.message}`);
  if (!data) return DEFAULT_PUBLISH_DEFAULTS;
  return {
    defaultVisibility: parseVisibility(data.default_visibility) ?? "public",
    generateSocial: data.generate_social !== false,
  };
}

export async function savePublishDefaults(userId: string, patch: Partial<PublishDefaults>): Promise<void> {
  const update = {
    ...(patch.defaultVisibility ? { default_visibility: patch.defaultVisibility } : {}),
    ...(typeof patch.generateSocial === "boolean" ? { generate_social: patch.generateSocial } : {}),
  };
  if (Object.keys(update).length === 0) return;
  const { error } = await createAdminClient()
    .from("profiles")
    .upsert({ id: userId, ...update }, { onConflict: "id" });
  if (error) throw new Error(`儲存發佈預設失敗：${error.message}`);
}
