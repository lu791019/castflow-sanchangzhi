import { describe, expect, it, vi } from "vitest";
import {
  NoTranscriptError,
  generateReading,
  loadReading,
  normalizeSummary,
  type BuildReadingFn,
  type ReadingRepo,
  type ReadingRow,
  type TranscriptRecord,
} from "./service";

const EN_TRANSCRIPT: TranscriptRecord = {
  id: "tx-1",
  language: "en",
  segments: [{ start: 0, end: 2, text: "Hello there." }],
};

function makeRepo(transcript: TranscriptRecord | null, reading: ReadingRow | null = null) {
  const saved: ReadingRow[] = [];
  const repo: ReadingRepo = {
    getLatestTranscript: vi.fn(async () => transcript),
    getReading: vi.fn(async () => reading),
    saveReading: vi.fn(async (_id, row) => {
      saved.push(row);
    }),
  };
  return { repo, saved };
}

const READY_RESULT = {
  segments: [
    {
      start: 0,
      end: 2,
      source_text: "Hello there.",
      source_lang: "en",
      translated_text: "你好。",
    },
  ],
  summary: [
    { text: "一", start: 0 },
    { text: "二", start: 0 },
    { text: "三", start: 0 },
  ],
  chapters: [{ title: "開場", start: 0 }],
  language: "en",
};

describe("generateReading", () => {
  it("英文集：先標 pending → 跑引擎 → 落 ready", async () => {
    const { repo, saved } = makeRepo(EN_TRANSCRIPT);
    const buildReading = vi.fn<BuildReadingFn>(async () => READY_RESULT);
    const outcome = await generateReading(
      { repo, buildReading, engineOptions: { batchSize: 10 } },
      "ep-1",
    );

    expect(outcome).toEqual({ status: "ready", segments: 1, summary: 3, chapters: 1 });
    expect(buildReading).toHaveBeenCalledWith(EN_TRANSCRIPT.segments, {
      batchSize: 10,
      language: "en",
    });
    expect(saved.map((r) => r.status)).toEqual(["pending", "ready"]);
    expect(saved[1]).toMatchObject({ transcript_id: "tx-1", summary: READY_RESULT.summary });
  });

  it("中文集：標 skipped，不呼叫引擎", async () => {
    const { repo, saved } = makeRepo({ ...EN_TRANSCRIPT, language: "zh" });
    const buildReading = vi.fn<BuildReadingFn>();
    const outcome = await generateReading({ repo, buildReading }, "ep-1");
    expect(outcome.status).toBe("skipped");
    expect(buildReading).not.toHaveBeenCalled();
    expect(saved.map((r) => r.status)).toEqual(["skipped"]);
  });

  it("引擎失敗：落 error + 原因，並重新拋出給呼叫端推警報", async () => {
    const { repo, saved } = makeRepo(EN_TRANSCRIPT);
    const buildReading = vi.fn<BuildReadingFn>(async () => {
      throw new Error("翻譯第 2/3 批 失敗");
    });
    await expect(generateReading({ repo, buildReading }, "ep-1")).rejects.toThrow("第 2/3 批");
    expect(saved[1]).toMatchObject({ status: "error", error_message: "翻譯第 2/3 批 失敗" });
  });

  it("沒有逐字稿 → NoTranscriptError", async () => {
    const { repo } = makeRepo(null);
    await expect(
      generateReading({ repo, buildReading: vi.fn<BuildReadingFn>() }, "ep-1"),
    ).rejects.toBeInstanceOf(NoTranscriptError);
  });
});

describe("loadReading", () => {
  it("有閱讀資料：回傳 segments/summary/chapters/language/status", async () => {
    const row: ReadingRow = {
      transcript_id: "tx-1",
      status: "ready",
      source_language: "en",
      segments: READY_RESULT.segments,
      summary: READY_RESULT.summary,
      chapters: READY_RESULT.chapters,
      error_message: null,
    };
    const { repo } = makeRepo(EN_TRANSCRIPT, row);
    expect(await loadReading(repo, "ep-1")).toEqual({
      segments: READY_RESULT.segments,
      summary: READY_RESULT.summary,
      summaryNeedsRecompute: false,
      chapters: READY_RESULT.chapters,
      language: "en",
      status: "ready",
      stale: false,
      error: null,
    });
  });

  it("重新轉錄後 transcript_id 不同 → stale", async () => {
    const row: ReadingRow = {
      transcript_id: "tx-old",
      status: "ready",
      source_language: "en",
      segments: [],
      summary: [],
      chapters: [],
      error_message: null,
    };
    const { repo } = makeRepo(EN_TRANSCRIPT, row);
    expect((await loadReading(repo, "ep-1")).stale).toBe(true);
  });

  it("尚無閱讀資料：依逐字稿推 none / skipped / no_transcript", async () => {
    expect((await loadReading(makeRepo(EN_TRANSCRIPT).repo, "e")).status).toBe("none");
    expect(
      (await loadReading(makeRepo({ ...EN_TRANSCRIPT, language: "Chinese" }).repo, "e")).status,
    ).toBe("skipped");
    const none = await loadReading(makeRepo(null).repo, "e");
    expect(none).toMatchObject({ status: "no_transcript", language: null, segments: [] });
  });
});

describe("normalizeSummary（舊資料相容）", () => {
  it("1e 初版純字串摘要 → start=null 並標記待重算", () => {
    expect(normalizeSummary(["一", " 二 ", ""])).toEqual({
      items: [
        { text: "一", start: null },
        { text: "二", start: null },
      ],
      needsRecompute: true,
    });
  });

  it("新版 {text,start} 不需重算；壞資料略過", () => {
    expect(normalizeSummary([{ text: "a", start: 12 }, { text: "", start: 1 }, 3, null])).toEqual({
      items: [{ text: "a", start: 12 }],
      needsRecompute: false,
    });
    expect(normalizeSummary(null)).toEqual({ items: [], needsRecompute: false });
  });

  it("loadReading 讀到舊格式 → summaryNeedsRecompute", async () => {
    const row: ReadingRow = {
      transcript_id: "tx-1",
      status: "ready",
      source_language: "en",
      segments: [],
      summary: ["舊的一條"],
      chapters: [],
      error_message: null,
    };
    const view = await loadReading(makeRepo(EN_TRANSCRIPT, row).repo, "ep-1");
    expect(view.summary).toEqual([{ text: "舊的一條", start: null }]);
    expect(view.summaryNeedsRecompute).toBe(true);
  });
});
