import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase admin client 與 generate 薄殼（engine 呼叫已在 engine 層測試）
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/anthropic/generate-content", () => ({
  generateAllPlatforms: vi.fn(),
}));
vi.mock("@/lib/journal/episode-link", () => ({
  linkJournalToEpisode: vi.fn(),
}));

import {
  ingestText,
  validateTextIngestInput,
  TextIngestGenerationError,
  MAX_TEXT_LENGTH,
} from "./text";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAllPlatforms } from "@/lib/anthropic/generate-content";
import { linkJournalToEpisode } from "@/lib/journal/episode-link";
import { ALL_PLATFORMS } from "@/lib/prompts/generate-content";

const USER_ID = "44444444-4444-4444-4444-444444444444";
const EPISODE_ID = "ep-123";

const MOCK_CONTENTS = Object.fromEntries(
  ALL_PLATFORMS.map((p) => [p, `${p} 文案`]),
) as Record<(typeof ALL_PLATFORMS)[number], string>;

function makeSupabaseMock() {
  const inserted: Record<string, Record<string, unknown>[]> = {};

  const from = (table: string) => ({
    insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted[table] = (inserted[table] ?? []).concat(
        Array.isArray(rows) ? rows : [rows],
      );
      const thenable = Promise.resolve({ error: null });
      return Object.assign(thenable, {
        select: () => ({
          single: async () => ({ data: { id: EPISODE_ID }, error: null }),
        }),
      });
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
  });

  return { client: { from }, inserted };
}

describe("validateTextIngestInput", () => {
  it("拒絕空 title / 空 text", () => {
    expect(validateTextIngestInput({ title: "", text: "內容" })).toBeTruthy();
    expect(validateTextIngestInput({ title: "標題", text: "  " })).toBeTruthy();
    expect(validateTextIngestInput(null)).toBeTruthy();
  });

  it("拒絕超長 text，接受合法輸入", () => {
    expect(
      validateTextIngestInput({
        title: "標題",
        text: "a".repeat(MAX_TEXT_LENGTH + 1),
      }),
    ).toBeTruthy();
    expect(
      validateTextIngestInput({ title: "標題", text: "正常內容" }),
    ).toBeNull();
  });

  it("workId 選填；有給必須是 UUID", () => {
    const base = { title: "標題", text: "內容" };
    expect(validateTextIngestInput({ ...base, workId: null })).toBeNull();
    expect(
      validateTextIngestInput({ ...base, workId: "6a630b81-778e-466a-81a6-8e2bccee7916" }),
    ).toBeNull();
    expect(validateTextIngestInput({ ...base, workId: "umimachi-diary" })).toBeTruthy();
    expect(validateTextIngestInput({ ...base, workId: 42 })).toBeTruthy();
  });

  it("journalId 選填；有給必須是 UUID", () => {
    const base = { title: "標題", text: "內容" };
    expect(validateTextIngestInput({ ...base, journalId: null })).toBeNull();
    expect(
      validateTextIngestInput({ ...base, journalId: "11111111-1111-1111-1111-111111111111" }),
    ).toBeNull();
    expect(validateTextIngestInput({ ...base, journalId: "abc" })).toBe("journalId 格式不正確");
  });
});

describe("ingestText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("建立 source='text' 的 episode + transcript，並寫入 6 平台 contents", async () => {
    const { client, inserted } = makeSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createAdminClient>,
    );
    vi.mocked(generateAllPlatforms).mockResolvedValue(MOCK_CONTENTS);

    const result = await ingestText(USER_ID, { title: " 測試集 ", text: " 一段文字 " });

    expect(result.episodeId).toBe(EPISODE_ID);

    // episode：文字來源、無音訊、跳過轉錄直接 transcribed
    expect(inserted.episodes).toEqual([
      {
        user_id: USER_ID,
        title: "測試集",
        source: "text",
        audio_url: null,
        status: "transcribed",
      },
    ]);

    // transcript：full_text = 貼入文字（trim 後）
    expect(inserted.transcripts).toHaveLength(1);
    expect(inserted.transcripts[0]).toMatchObject({
      episode_id: EPISODE_ID,
      full_text: "一段文字",
    });

    // contents：6 平台草稿
    expect(inserted.contents).toHaveLength(ALL_PLATFORMS.length);
    for (const row of inserted.contents) {
      expect(row.episode_id).toBe(EPISODE_ID);
      expect(row.user_id).toBe(USER_ID);
      expect(row.status).toBe("draft");
      expect(row.body).toBe(`${row.platform} 文案`);
    }
    expect(vi.mocked(generateAllPlatforms)).toHaveBeenCalledWith("一段文字");
  });

  it("從作品特輯進來：episode 綁定 work_id", async () => {
    const { client, inserted } = makeSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createAdminClient>,
    );
    vi.mocked(generateAllPlatforms).mockResolvedValue(MOCK_CONTENTS);
    const workId = "6a630b81-778e-466a-81a6-8e2bccee7916";

    await ingestText(USER_ID, { title: "剛看完《海街日記》", text: "一段文字", workId });

    expect(inserted.episodes[0]).toMatchObject({ work_id: workId, source: "text" });
  });

  it("從視聽日誌進來：建完 episode 就連結該筆紀錄", async () => {
    const { client } = makeSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createAdminClient>,
    );
    vi.mocked(generateAllPlatforms).mockResolvedValue(MOCK_CONTENTS);
    const journalId = "11111111-1111-1111-1111-111111111111";

    await ingestText(USER_ID, { title: "t", text: "一段文字", journalId });

    expect(vi.mocked(linkJournalToEpisode)).toHaveBeenCalledWith(USER_ID, journalId, EPISODE_ID);
  });

  it("連結日誌失敗不擋文章生成", async () => {
    const { client, inserted } = makeSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createAdminClient>,
    );
    vi.mocked(generateAllPlatforms).mockResolvedValue(MOCK_CONTENTS);
    vi.mocked(linkJournalToEpisode).mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await ingestText(USER_ID, {
      title: "t",
      text: "一段文字",
      journalId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.episodeId).toBe(EPISODE_ID);
    expect(inserted.contents).toHaveLength(ALL_PLATFORMS.length);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("沒有 journalId 不連結", async () => {
    const { client } = makeSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createAdminClient>,
    );
    vi.mocked(generateAllPlatforms).mockResolvedValue(MOCK_CONTENTS);
    await ingestText(USER_ID, { title: "t", text: "一段文字" });
    expect(vi.mocked(linkJournalToEpisode)).not.toHaveBeenCalled();
  });

  it("生成失敗時拋 TextIngestGenerationError 並帶 episodeId", async () => {
    const { client } = makeSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createAdminClient>,
    );
    vi.mocked(generateAllPlatforms).mockRejectedValue(
      new Error("LLM 掛了"),
    );

    const promise = ingestText(USER_ID, { title: "測試集", text: "一段文字" });

    await expect(promise).rejects.toBeInstanceOf(TextIngestGenerationError);
    await expect(promise).rejects.toMatchObject({
      episodeId: EPISODE_ID,
      message: "LLM 掛了",
    });
  });
});
