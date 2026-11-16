"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { transcribeAudio } from "@/lib/openai/whisper";
import { DOWNLOAD_URL_TTL_SECONDS, signStoredAudioUrl } from "@/lib/audio/signed-url";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";

export async function startTranscriptionAction(episodeId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  const supabase = createAdminClient();

  const { data: episode, error: epError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (epError || !episode) {
    return { error: "找不到集數" };
  }

  if (episode.status !== "uploaded") {
    return { error: `此集數狀態為「${episode.status}」，無法轉錄` };
  }

  await supabase
    .from("episodes")
    .update({ status: "transcribing" })
    .eq("id", episodeId);

  try {
    const result = await transcribeAudio(
      await signStoredAudioUrl(supabase, episode.audio_url, DOWNLOAD_URL_TTL_SECONDS),
    );

    const { error: insertError } = await supabase.from("transcripts").insert({
      episode_id: episodeId,
      full_text: result.fullText,
      segments: result.segments,
      language: result.language,
    });

    if (insertError) throw insertError;

    await supabase
      .from("episodes")
      .update({ status: "transcribed" })
      .eq("id", episodeId);

    return { success: true };
  } catch (error) {
    await supabase
      .from("episodes")
      .update({ status: "error" })
      .eq("id", episodeId);

    const message = error instanceof Error ? error.message : "轉錄失敗";
    return { error: message };
  }
}
