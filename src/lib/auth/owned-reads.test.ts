import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isUuid,
  loadEpisodeEditData,
  loadEpisodeGenerateData,
  loadOwnedStyle,
  TRANSCRIPT_PREVIEW_CHARS,
} from "./owned-reads";

type Row = Record<string, unknown>;

/** 最小假 PostgREST：支援 select/eq/order/limit/maybeSingle/await */
function fakeDb(tables: Record<string, Row[]>, failTables: string[] = []): SupabaseClient {
  function query(table: string) {
    let rows = [...(tables[table] ?? [])];
    const error = failTables.includes(table) ? { message: `${table} boom` } : null;
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value);
        return builder;
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        const dir = opts?.ascending === false ? -1 : 1;
        rows = [...rows].sort((a, b) => (String(a[column]) > String(b[column]) ? dir : -dir));
        return builder;
      },
      limit: (n: number) => {
        rows = rows.slice(0, n);
        return builder;
      },
      maybeSingle: async () => ({ data: error ? null : (rows[0] ?? null), error }),
      then: (resolve: (value: { data: Row[] | null; error: unknown }) => unknown) =>
        resolve({ data: error ? null : rows, error }),
    };
    return builder;
  }
  return { from: query } as unknown as SupabaseClient;
}

const A = "user-a";
const B = "user-b";
const EP = "11111111-1111-4111-8111-111111111111";
const STYLE = "22222222-2222-4222-8222-222222222222";

const tables = {
  episodes: [{ id: EP, user_id: A, title: "第一集", status: "transcribed" }],
  contents: [
    { id: "c2", episode_id: EP, user_id: A, platform: "threads", body: "t" },
    { id: "c1", episode_id: EP, user_id: A, platform: "facebook", body: "f" },
  ],
  transcripts: [
    { id: "t-old", episode_id: EP, full_text: "舊", created_at: "2026-01-01" },
    { id: "t-new", episode_id: EP, full_text: "新".repeat(800), created_at: "2026-02-01" },
  ],
  style_dnas: [
    {
      id: STYLE,
      user_id: A,
      name: "我的風格",
      platform: "threads",
      source_example_count: 3,
      dimensions: { tone: "輕鬆" },
    },
  ],
};

describe("isUuid", () => {
  it("合法 uuid", () => expect(isUuid(EP)).toBe(true));
  it.each(["", "abc", "1111", `${EP}x`])("非法 %s", (value) => expect(isUuid(value)).toBe(false));
});

describe("loadEpisodeEditData", () => {
  it("擁有者拿到集數標題與依平台排序的文案", async () => {
    const data = await loadEpisodeEditData(fakeDb(tables), A, EP);
    expect(data?.episode).toEqual({ id: EP, title: "第一集" });
    expect(data?.contents.map((c) => c.platform)).toEqual(["facebook", "threads"]);
  });

  it("別人的集數回 null（當成找不到）", async () => {
    expect(await loadEpisodeEditData(fakeDb(tables), B, EP)).toBeNull();
  });

  it("非法 id 直接回 null，不查 DB", async () => {
    expect(await loadEpisodeEditData(fakeDb({}, ["episodes"]), A, "not-a-uuid")).toBeNull();
  });

  it("查詢錯誤要拋出，不靜默當成沒資料", async () => {
    await expect(loadEpisodeEditData(fakeDb(tables, ["contents"]), A, EP)).rejects.toThrow(
      /contents boom/,
    );
  });
});

describe("loadEpisodeGenerateData", () => {
  it("擁有者拿到最新逐字稿預覽與是否已有文案", async () => {
    const data = await loadEpisodeGenerateData(fakeDb(tables), A, EP);
    expect(data?.episode).toEqual({ id: EP, title: "第一集", status: "transcribed" });
    expect(data?.transcriptPreview).toBe("新".repeat(TRANSCRIPT_PREVIEW_CHARS));
    expect(data?.hasContent).toBe(true);
  });

  it("沒有逐字稿與文案時給空值", async () => {
    const data = await loadEpisodeGenerateData(fakeDb({ episodes: tables.episodes }), A, EP);
    expect(data?.transcriptPreview).toBe("");
    expect(data?.hasContent).toBe(false);
  });

  it("別人的集數回 null", async () => {
    expect(await loadEpisodeGenerateData(fakeDb(tables), B, EP)).toBeNull();
  });
});

describe("loadOwnedStyle", () => {
  it("擁有者拿到風格", async () => {
    expect(await loadOwnedStyle(fakeDb(tables), A, STYLE)).toEqual({
      id: STYLE,
      name: "我的風格",
      platform: "threads",
      exampleCount: 3,
      dimensions: { tone: "輕鬆" },
    });
  });

  it("別人的風格回 null", async () => {
    expect(await loadOwnedStyle(fakeDb(tables), B, STYLE)).toBeNull();
  });

  it("查詢錯誤要拋出", async () => {
    await expect(loadOwnedStyle(fakeDb(tables, ["style_dnas"]), A, STYLE)).rejects.toThrow(
      /style_dnas boom/,
    );
  });
});
