import { createAdminClient } from "@/lib/supabase/admin";
import { generateAllPlatforms } from "@/lib/anthropic/generate-content";
import { ALL_PLATFORMS } from "@/lib/prompts/generate-content";
import { linkJournalToEpisode } from "@/lib/journal/episode-link";

export const MAX_TITLE_LENGTH = 200;
export const MAX_TEXT_LENGTH = 100_000;

export interface TextIngestInput {
  title: string;
  text: string;
  /** 從作品特輯進來（/say?work=<slug>）時綁定的作品 id */
  workId?: string | null;
  /** 從視聽日誌進來（/say?journal=<id>）時連結的紀錄 id */
  journalId?: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateOptionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return `${field} 格式不正確`;
  }
  return null;
}

/** workId 為選填；有給就必須是 UUID */
export function validateWorkId(workId: unknown): string | null {
  return validateOptionalUuid(workId, "workId");
}

/** journalId 為選填；有給就必須是 UUID */
export function validateJournalId(journalId: unknown): string | null {
  return validateOptionalUuid(journalId, "journalId");
}

export interface TextIngestResult {
  episodeId: string;
}

/** 生成階段失敗：episode 與 transcript 已建立，可從既有 UI 重試生成 */
export class TextIngestGenerationError extends Error {
  readonly episodeId: string;

  constructor(episodeId: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : "文案生成失敗";
    super(detail);
    this.name = "TextIngestGenerationError";
    this.episodeId = episodeId;
  }
}

/** 純驗證：回傳錯誤訊息，通過則回傳 null */
export function validateTextIngestInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return "請提供 title 與 text";
  }
  const { title, text } = input as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim()) {
    return "title 不能為空";
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    return `title 不能超過 ${MAX_TITLE_LENGTH} 字`;
  }
  if (typeof text !== "string" || !text.trim()) {
    return "text 不能為空";
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return `text 不能超過 ${MAX_TEXT_LENGTH} 字`;
  }
  const record = input as Record<string, unknown>;
  return validateWorkId(record.workId) ?? validateJournalId(record.journalId);
}

/**
 * 文字輸入煙囪（Q-24）：貼文字 → 跳過轉錄 → 直接生成 6 平台文案。
 * 與音訊路徑併軌：同樣落 episodes + transcripts + contents，
 * 僅 source='text'、status 直接進 'transcribed'。
 */
export async function ingestText(
  userId: string,
  input: TextIngestInput,
): Promise<TextIngestResult> {
  const title = input.title.trim();
  const text = input.text.trim();

  const supabase = createAdminClient();

  // 1. 建 episode（文字來源，無音訊，直接視為已轉錄）
  const { data: episode, error: epError } = await supabase
    .from("episodes")
    .insert({
      user_id: userId,
      title,
      source: "text",
      audio_url: null,
      status: "transcribed",
      ...(input.workId ? { work_id: input.workId } : {}),
    })
    .select("id")
    .single();

  if (epError || !episode) {
    throw new Error(`建立 episode 失敗：${epError?.message ?? "unknown"}`);
  }

  // 1b. 從視聽日誌進來：先連結（發佈／存草稿時才標 said）；連結失敗不擋文章，署名退回錄下時刻
  if (input.journalId) {
    try {
      await linkJournalToEpisode(userId, input.journalId, episode.id);
    } catch (error) {
      console.error("[ingest] 連結視聽日誌失敗", {
        journalId: input.journalId,
        episodeId: episode.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 2. 落 transcript（整段文字視為單一 segment，沿用既有檢視元件）
  const { error: txError } = await supabase.from("transcripts").insert({
    episode_id: episode.id,
    full_text: text,
    segments: [{ start: 0, end: 0, text }],
    language: "zh-TW",
  });

  if (txError) {
    throw new Error(`建立 transcript 失敗：${txError.message}`);
  }

  // 3. 走既有 generate 流程（引擎呼叫經 src/lib 薄殼 → @castflow/engine）
  try {
    const results = await generateAllPlatforms(text);

    await supabase.from("contents").delete().eq("episode_id", episode.id);

    const inserts = ALL_PLATFORMS.map((platform) => ({
      user_id: userId,
      episode_id: episode.id,
      platform,
      body: results[platform],
      original_body: results[platform],
      status: "draft",
    }));

    const { error: insertError } = await supabase
      .from("contents")
      .insert(inserts);

    if (insertError) throw insertError;
  } catch (error) {
    throw new TextIngestGenerationError(episode.id, error);
  }

  return { episodeId: episode.id };
}
