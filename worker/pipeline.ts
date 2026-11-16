import type { Notify } from "./notify.ts";
import type { QueuedEpisode, TranscriptionResult } from "./types.ts";

/**
 * 單集處理的依賴注入介面：實作綁 mlx/Groq/Supabase，
 * 測試時換成假件；對外部署時整層換雲端函式。
 */
export interface PipelineDeps {
  claim(episodeId: string): Promise<boolean>;
  /** 下載（必要時裁剪）→ 回傳本機音檔路徑 */
  prepareAudio(audioUrl: string): Promise<string>;
  transcribeLocal(audioPath: string): Promise<TranscriptionResult>;
  /**
   * Groq fallback（/api/transcribe 路徑自己寫 transcript 與狀態）。
   * audioPath 為已備妥的本機檔；下載就失敗時為 null，交給 app 自行下載。
   */
  transcribeFallback(episodeId: string, audioPath: string | null): Promise<void>;
  saveTranscript(episodeId: string, result: TranscriptionResult): Promise<void>;
  setStatus(episodeId: string, status: "transcribed" | "error"): Promise<void>;
  generate(episodeId: string): Promise<void>;
  /** 雙語 + 摘要 + 章節；回傳 app 端狀態（ready / skipped…） */
  understand(episodeId: string): Promise<{ status: string }>;
  notify: Notify;
}

export interface ProcessResult {
  transcribedVia: "mlx" | "groq-fallback" | "none";
  generated: boolean;
  /** 閱讀引擎結果：ready / skipped（中文）/ failed / none（未轉錄成功） */
  reading: string;
  skipped: boolean;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 降級鏈：mlx 本機轉錄 → 失敗推 warn 警報改走 Groq →
 * 再失敗標 error + 推 error 警報。轉錄成功後跑文案生成與閱讀引擎（雙語+摘要+章節），
 * 兩者失敗各自推警報，不動已完成的逐字稿。
 */
export async function processEpisode(
  deps: PipelineDeps,
  episode: QueuedEpisode,
): Promise<ProcessResult> {
  const claimed = await deps.claim(episode.id);
  if (!claimed) {
    return { transcribedVia: "none", generated: false, reading: "none", skipped: true };
  }

  const label = `${episode.title}（${episode.id}）`;
  let transcribedVia: "mlx" | "groq-fallback";
  let audioPath: string | null = null;

  try {
    audioPath = await deps.prepareAudio(episode.audio_url);
    const result = await deps.transcribeLocal(audioPath);
    await deps.saveTranscript(episode.id, result);
    await deps.setStatus(episode.id, "transcribed");
    transcribedVia = "mlx";
  } catch (mlxError) {
    await deps.notify(
      "warn",
      "mlx 轉錄失敗，降級改走 Groq",
      `${label}：${messageOf(mlxError)}`,
    );
    try {
      await deps.transcribeFallback(episode.id, audioPath);
      transcribedVia = "groq-fallback";
    } catch (groqError) {
      await deps.setStatus(episode.id, "error");
      await deps.notify(
        "error",
        "轉錄全數失敗，episode 已標 error",
        `${label}：mlx=${messageOf(mlxError)}；groq=${messageOf(groqError)}`,
      );
      return { transcribedVia: "none", generated: false, reading: "none", skipped: false };
    }
  }

  const generated = await runStep(deps, label, "文案生成失敗（逐字稿已保留）", () =>
    deps.generate(episode.id),
  );
  // 閱讀引擎與文案生成互相獨立：任一失敗都推警報，不影響另一個
  let reading = "failed";
  await runStep(deps, label, "雙語閱讀產出失敗（逐字稿已保留）", async () => {
    reading = (await deps.understand(episode.id)).status;
  });
  return { transcribedVia, generated, reading, skipped: false };
}

/** 跑一個轉錄後步驟；失敗推 error 警報（不靜默）並回 false */
async function runStep(
  deps: PipelineDeps,
  label: string,
  alertTitle: string,
  step: () => Promise<void>,
): Promise<boolean> {
  try {
    await step();
    return true;
  } catch (error) {
    await deps.notify("error", alertTitle, `${label}：${messageOf(error)}`);
    return false;
  }
}
