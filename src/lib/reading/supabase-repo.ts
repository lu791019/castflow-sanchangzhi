import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingRepo, ReadingRow, TranscriptRecord } from "./service";

/** ReadingRepo 的 Supabase 實作（transcripts 取最新一份；episode_readings 每集一列 upsert） */
export function createSupabaseReadingRepo(supabase: SupabaseClient): ReadingRepo {
  return {
    async getLatestTranscript(episodeId) {
      const { data, error } = await supabase
        .from("transcripts")
        .select("id, language, segments")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`讀取逐字稿失敗：${error.message}`);
      return (data as TranscriptRecord | null) ?? null;
    },

    async getReading(episodeId) {
      const { data, error } = await supabase
        .from("episode_readings")
        .select("transcript_id, status, source_language, segments, summary, chapters, error_message")
        .eq("episode_id", episodeId)
        .maybeSingle();
      if (error) throw new Error(`讀取閱讀資料失敗：${error.message}`);
      return (data as ReadingRow | null) ?? null;
    },

    async saveReading(episodeId, row) {
      const { error } = await supabase
        .from("episode_readings")
        .upsert(
          { episode_id: episodeId, ...row, updated_at: new Date().toISOString() },
          { onConflict: "episode_id" },
        );
      if (error) throw new Error(`寫入閱讀資料失敗：${error.message}`);
    },
  };
}
