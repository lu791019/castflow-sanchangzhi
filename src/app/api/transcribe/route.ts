import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { transcribeAudio, transcribeAudioBuffer } from "@/lib/openai/whisper";
import { DOWNLOAD_URL_TTL_SECONDS, signStoredAudioUrl } from "@/lib/audio/signed-url";

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  // multipart：本機 worker 上傳已壓縮的音檔；JSON：由此處下載 audio_url
  const isMultipart = (request.headers.get("content-type") ?? "").includes(
    "multipart/form-data",
  );
  let episodeId: unknown;
  let uploadedAudio: File | null = null;
  try {
    if (isMultipart) {
      const form = await request.formData();
      episodeId = form.get("episodeId");
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) {
        return NextResponse.json({ error: "audio file is required" }, { status: 400 });
      }
      uploadedAudio = audio;
    } else {
      ({ episodeId } = await request.json());
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof episodeId !== "string" || !episodeId) {
    return NextResponse.json({ error: "episodeId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get episode
  const { data: episode, error: epError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .single();

  if (epError || !episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  // Update status to transcribing
  await supabase
    .from("episodes")
    .update({ status: "transcribing" })
    .eq("id", episodeId);

  try {
    const result = uploadedAudio
      ? await transcribeAudioBuffer(await uploadedAudio.arrayBuffer(), uploadedAudio.name)
      : await transcribeAudio(
          await signStoredAudioUrl(supabase, episode.audio_url, DOWNLOAD_URL_TTL_SECONDS),
        );

    // Save transcript
    const { error: insertError } = await supabase.from("transcripts").insert({
      episode_id: episodeId,
      full_text: result.fullText,
      segments: result.segments,
      language: result.language,
    });

    if (insertError) throw insertError;

    // Update episode status
    await supabase
      .from("episodes")
      .update({ status: "transcribed" })
      .eq("id", episodeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    await supabase
      .from("episodes")
      .update({ status: "error" })
      .eq("id", episodeId);

    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
