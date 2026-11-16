"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateAllPlatforms,
  generateSinglePlatform,
} from "@/lib/anthropic/generate-content";
import { ALL_PLATFORMS } from "@/lib/prompts/generate-content";
import { Platform } from "@/lib/types";
import { isSiteOwner } from "@/lib/auth/admin";
import { ownsContent, ownsEpisode, ownsStyle } from "@/lib/auth/ownership";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";

const NOT_FOUND = "找不到此內容";
/** Meta 發佈用的是全站共用 token（settings），只有站長能排程／立即發佈 */
const OWNER_ONLY = "社群發佈目前只開放站長使用";

async function ownsContentAsSiteOwner(userId: string, contentId: string): Promise<boolean> {
  return (await isSiteOwner(userId)) && (await ownsContent(userId, contentId));
}

/** 登入 + 擁有者檢查；通過回 userId，否則回 { error } */
async function guard(
  check: (userId: string) => Promise<boolean>,
): Promise<{ userId: string } | { error: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  if (!(await check(userId))) return { error: NOT_FOUND };
  return { userId };
}

export async function generateContentAction(episodeId: string) {
  const auth = await guard((userId) => ownsEpisode(userId, episodeId));
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // Get transcript
  const { data: transcript, error: txError } = await supabase
    .from("transcripts")
    .select("full_text")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (txError || !transcript) {
    return { error: "找不到逐字稿，請先完成轉錄。" };
  }

  try {
    const results = await generateAllPlatforms(transcript.full_text);

    // Delete existing content for this episode
    await supabase.from("contents").delete().eq("episode_id", episodeId).in("platform", ALL_PLATFORMS);

    // Insert new content (store original_body for diff analysis)
    const inserts = ALL_PLATFORMS.map((platform) => ({
      user_id: auth.userId,
      episode_id: episodeId,
      platform,
      body: results[platform],
      original_body: results[platform],
      status: "draft",
    }));

    const { error: insertError } = await supabase
      .from("contents")
      .insert(inserts);

    if (insertError) throw insertError;

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "文案生成失敗";
    return { error: message };
  }
}

export async function regenerateSingleAction(
  episodeId: string,
  platform: Platform,
) {
  const auth = await guard((userId) => ownsEpisode(userId, episodeId));
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // Get transcript
  const { data: transcript, error: txError } = await supabase
    .from("transcripts")
    .select("full_text")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (txError || !transcript) {
    return { error: "找不到逐字稿。" };
  }

  try {
    const body = await generateSinglePlatform(
      transcript.full_text,
      platform,
    );

    // Delete existing content for this episode+platform
    await supabase
      .from("contents")
      .delete()
      .eq("episode_id", episodeId)
      .eq("platform", platform);

    // Insert new (store original_body for diff analysis)
    const { error: insertError } = await supabase.from("contents").insert({
      user_id: auth.userId,
      episode_id: episodeId,
      platform,
      body,
      original_body: body,
      status: "draft",
    });

    if (insertError) throw insertError;

    return { success: true, body };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "重新生成失敗";
    return { error: message };
  }
}

export async function updateContentAction(contentId: string, body: string) {
  const auth = await guard((userId) => ownsContent(userId, contentId));
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("contents")
    .update({ body })
    .eq("id", contentId);

  if (error) {
    return { error: "儲存失敗" };
  }

  return { success: true };
}

export async function scheduleContentAction(
  contentId: string,
  scheduledAt: string,
) {
  const auth = await guard((userId) => ownsContentAsSiteOwner(userId, contentId));
  if ("error" in auth) return { error: auth.error === NOT_FOUND ? OWNER_ONLY : auth.error };
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("contents")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", contentId);

  if (error) return { error: "排程設定失敗" };
  return { success: true };
}

export async function publishNowAction(contentId: string) {
  const auth = await guard((userId) => ownsContentAsSiteOwner(userId, contentId));
  if ("error" in auth) {
    return { success: false as const, error: auth.error === NOT_FOUND ? OWNER_ONLY : auth.error };
  }
  const { publishContent } = await import("@/lib/meta/publish");
  return publishContent(contentId);
}

export async function cancelScheduleAction(contentId: string) {
  const auth = await guard((userId) => ownsContent(userId, contentId));
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("contents")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", contentId);

  if (error) return { error: "取消排程失敗" };
  return { success: true };
}

export async function analyzeEditDiffAction(contentId: string) {
  const auth = await guard((userId) => ownsContent(userId, contentId));
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { data: content, error } = await supabase
    .from("contents")
    .select("platform, body, original_body")
    .eq("id", contentId)
    .single();

  if (error || !content) return { error: "找不到此內容" };
  if (!content.original_body) return { error: "沒有原始版本可供比對" };
  if (content.body === content.original_body) return { error: "內容未修改，無差異可分析" };

  try {
    const { analyzeEditDiff } = await import("@/lib/anthropic/analyze-edit");
    const suggestions = await analyzeEditDiff(
      content.platform,
      content.original_body,
      content.body,
    );
    return { success: true, suggestions };
  } catch (err) {
    const message = err instanceof Error ? err.message : "分析失敗";
    return { error: message };
  }
}

export async function applyStyleSuggestionsAction(
  styleDnaId: string,
  updates: Record<string, string>,
) {
  const auth = await guard((userId) => ownsStyle(userId, styleDnaId));
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { data: style, error: fetchError } = await supabase
    .from("style_dnas")
    .select("dimensions")
    .eq("id", styleDnaId)
    .single();

  if (fetchError || !style) return { error: "找不到此風格" };

  const merged = { ...style.dimensions, ...updates };

  const { error: updateError } = await supabase
    .from("style_dnas")
    .update({ dimensions: merged })
    .eq("id", styleDnaId);

  if (updateError) return { error: "更新風格失敗" };
  return { success: true };
}
