import { describe, expect, it, vi } from "vitest";
import { processEpisode, type PipelineDeps } from "./pipeline.ts";
import type { QueuedEpisode, TranscriptionResult } from "./types.ts";

const EPISODE: QueuedEpisode = {
  id: "ep-1",
  title: "測試集",
  audio_url: "https://example.com/a.mp3",
};

const RESULT: TranscriptionResult = {
  fullText: "hello",
  segments: [{ start: 0, end: 1, text: "hello" }],
  language: "en",
};

function makeDeps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    claim: vi.fn(async () => true),
    prepareAudio: vi.fn(async () => "/tmp/a.mp3"),
    transcribeLocal: vi.fn(async () => RESULT),
    transcribeFallback: vi.fn(async () => {}),
    saveTranscript: vi.fn(async () => {}),
    setStatus: vi.fn(async () => {}),
    generate: vi.fn(async () => {}),
    understand: vi.fn(async () => ({ status: "ready" })),
    notify: vi.fn(async (level, title, detail) => ({
      at: "t",
      level,
      title,
      detail: detail ?? "",
    })),
    ...overrides,
  };
}

describe("processEpisode", () => {
  it("正常路徑：mlx 轉錄 → 寫 transcript → transcribed → 生成", async () => {
    const deps = makeDeps();
    const result = await processEpisode(deps, EPISODE);
    expect(result).toEqual({
      transcribedVia: "mlx",
      generated: true,
      reading: "ready",
      skipped: false,
    });
    expect(deps.saveTranscript).toHaveBeenCalledWith("ep-1", RESULT);
    expect(deps.setStatus).toHaveBeenCalledWith("ep-1", "transcribed");
    expect(deps.generate).toHaveBeenCalledWith("ep-1");
    expect(deps.transcribeFallback).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("認領失敗（被 /say 行內流程搶先）→ 跳過不動任何狀態", async () => {
    const deps = makeDeps({ claim: vi.fn(async () => false) });
    const result = await processEpisode(deps, EPISODE);
    expect(result.skipped).toBe(true);
    expect(deps.prepareAudio).not.toHaveBeenCalled();
    expect(deps.setStatus).not.toHaveBeenCalled();
  });

  it("mlx 失敗 → warn 警報 → Groq fallback 成功 → 照樣生成", async () => {
    const deps = makeDeps({
      transcribeLocal: vi.fn(async () => {
        throw new Error("mlx 掛了");
      }),
    });
    const result = await processEpisode(deps, EPISODE);
    expect(result).toEqual({
      transcribedVia: "groq-fallback",
      generated: true,
      reading: "ready",
      skipped: false,
    });
    expect(deps.notify).toHaveBeenCalledWith(
      "warn",
      "mlx 轉錄失敗，降級改走 Groq",
      expect.stringContaining("mlx 掛了"),
    );
    expect(deps.transcribeFallback).toHaveBeenCalledWith("ep-1", "/tmp/a.mp3");
    // fallback 路徑由 /api/transcribe 自己寫狀態，worker 不再重寫
    expect(deps.setStatus).not.toHaveBeenCalled();
  });

  it("mlx 與 Groq 都失敗 → 標 error + error 警報，不觸發生成", async () => {
    const deps = makeDeps({
      transcribeLocal: vi.fn(async () => {
        throw new Error("mlx 掛了");
      }),
      transcribeFallback: vi.fn(async () => {
        throw new Error("groq 也掛了");
      }),
    });
    const result = await processEpisode(deps, EPISODE);
    expect(result).toEqual({
      transcribedVia: "none",
      generated: false,
      reading: "none",
      skipped: false,
    });
    expect(deps.setStatus).toHaveBeenCalledWith("ep-1", "error");
    expect(deps.notify).toHaveBeenCalledWith(
      "error",
      "轉錄全數失敗，episode 已標 error",
      expect.stringContaining("groq 也掛了"),
    );
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.understand).not.toHaveBeenCalled();
  });

  it("下載失敗同樣進降級鏈（prepareAudio 丟錯 → fallback）", async () => {
    const deps = makeDeps({
      prepareAudio: vi.fn(async () => {
        throw new Error("下載音訊失敗：HTTP 403");
      }),
    });
    const result = await processEpisode(deps, EPISODE);
    expect(result.transcribedVia).toBe("groq-fallback");
    expect(deps.transcribeLocal).not.toHaveBeenCalled();
    // 沒有本機音檔 → 交給 app 端自行下載
    expect(deps.transcribeFallback).toHaveBeenCalledWith("ep-1", null);
  });

  it("生成失敗 → error 警報，逐字稿保留（狀態仍 transcribed）", async () => {
    const deps = makeDeps({
      generate: vi.fn(async () => {
        throw new Error("claude 爆了");
      }),
    });
    const result = await processEpisode(deps, EPISODE);
    expect(result).toEqual({
      transcribedVia: "mlx",
      generated: false,
      reading: "ready",
      skipped: false,
    });
    expect(deps.setStatus).toHaveBeenCalledWith("ep-1", "transcribed");
    expect(deps.notify).toHaveBeenCalledWith(
      "error",
      "文案生成失敗（逐字稿已保留）",
      expect.stringContaining("claude 爆了"),
    );
  });

  it("轉錄後觸發閱讀引擎；中文集由 app 回 skipped", async () => {
    const deps = makeDeps({ understand: vi.fn(async () => ({ status: "skipped" })) });
    const result = await processEpisode(deps, EPISODE);
    expect(deps.understand).toHaveBeenCalledWith("ep-1");
    expect(result.reading).toBe("skipped");
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("閱讀引擎失敗 → error 警報（不靜默），不影響文案生成結果", async () => {
    const deps = makeDeps({
      understand: vi.fn(async () => {
        throw new Error("翻譯第 3/14 批 失敗");
      }),
    });
    const result = await processEpisode(deps, EPISODE);
    expect(result).toMatchObject({ generated: true, reading: "failed" });
    expect(deps.notify).toHaveBeenCalledWith(
      "error",
      "雙語閱讀產出失敗（逐字稿已保留）",
      expect.stringContaining("翻譯第 3/14 批"),
    );
  });

  it("文案生成失敗仍會跑閱讀引擎", async () => {
    const deps = makeDeps({
      generate: vi.fn(async () => {
        throw new Error("claude 爆了");
      }),
    });
    const result = await processEpisode(deps, EPISODE);
    expect(deps.understand).toHaveBeenCalledWith("ep-1");
    expect(result.reading).toBe("ready");
  });
});
