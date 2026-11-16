import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { commitImport, previewImport, type ImportDeps, type ImportRepo } from "./service";

const HTML = readFileSync(join(__dirname, "__fixtures__", "wordpress.html"), "utf8");
const URL_IN = "https://blog.example.com/2015/04/master/?utm_source=fb";
const URL_KEY = "https://blog.example.com/2015/04/master";
const WORK_ID = "11111111-2222-4333-8444-555555555555";
const GUESS = '<result>{"title":"師父","originalTitle":"The Final Master","kind":"movie","year":2015}</result>';

function makeRepo(overrides: Partial<ImportRepo> = {}): ImportRepo {
  return {
    findImported: vi.fn().mockResolvedValue(null),
    workExists: vi.fn().mockResolvedValue(true),
    insertImported: vi.fn().mockResolvedValue({ episodeId: "ep-1", shareSlug: "abc123" }),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    repo: makeRepo(),
    fetchPage: vi.fn().mockResolvedValue({ html: HTML, finalUrl: URL_KEY }),
    guessLlm: vi.fn().mockResolvedValue(GUESS),
    warn: vi.fn().mockResolvedValue(undefined),
    now: () => new Date("2026-10-14T02:00:00Z"),
    ...overrides,
  };
}

describe("previewImport", () => {
  it("正規化網址 → 抓取 → 抽正文 → 判斷作品", async () => {
    const deps = makeDeps();
    const outcome = await previewImport(deps, "user-1", URL_IN);
    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready") return;
    expect(outcome.preview).toMatchObject({
      url: URL_KEY,
      domain: "blog.example.com",
      title: "《師父》：規矩森嚴的武林",
      publishedAt: "2015-04-02T02:30:00.000Z",
      guess: { title: "師父", kind: "movie", year: 2015 },
    });
    expect(outcome.preview.excerpt.length).toBeLessThanOrEqual(4);
    expect(outcome.preview.charCount).toBeGreaterThan(100);
    expect((deps.fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][0].href).toBe(URL_KEY);
  });

  it("同一使用者已搬過 → duplicate，不再抓取", async () => {
    const repo = makeRepo({ findImported: vi.fn().mockResolvedValue({ title: "師父", shareSlug: "abc123" }) });
    const deps = makeDeps({ repo });
    await expect(previewImport(deps, "user-1", URL_IN)).resolves.toEqual({
      status: "duplicate",
      existing: { title: "師父", href: "/s/abc123" },
    });
    expect(repo.findImported).toHaveBeenCalledWith("user-1", URL_KEY);
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it("網址不合法 → invalid", async () => {
    await expect(previewImport(makeDeps(), "user-1", "https://localhost/a")).resolves.toEqual({
      status: "invalid",
      error: "這個網址抓不到文章",
    });
  });

  it("抓取失敗 → failed 並推 warn", async () => {
    const deps = makeDeps({ fetchPage: vi.fn().mockRejectedValue(new Error("來源回應 503")) });
    const outcome = await previewImport(deps, "user-1", URL_IN);
    expect(outcome).toEqual({ status: "failed", error: "抓不到這篇文章，確認網址能公開瀏覽後再試一次" });
    expect(deps.warn).toHaveBeenCalledWith("文章匯入：抓取失敗", expect.stringContaining("來源回應 503"));
  });

  it("抽不到正文 → failed（明確錯誤）", async () => {
    const deps = makeDeps({ fetchPage: vi.fn().mockResolvedValue({ html: "<html><body><nav>首頁</nav></body></html>", finalUrl: URL_KEY }) });
    await expect(previewImport(deps, "user-1", URL_IN)).resolves.toEqual({
      status: "failed",
      error: "這個網址抓不到正文，請貼單篇文章的網址",
    });
  });

  it("LLM 失敗 → 照樣回預覽、guess 為 null，並推 warn", async () => {
    const deps = makeDeps({ guessLlm: vi.fn().mockRejectedValue(new Error("rate limited")) });
    const outcome = await previewImport(deps, "user-1", URL_IN);
    expect(outcome.status === "ready" && outcome.preview.guess).toBeNull();
    expect(deps.warn).toHaveBeenCalledWith("文章匯入：判斷作品失敗（改手動選）", expect.stringContaining("rate limited"));
  });
});

describe("commitImport", () => {
  const input = { url: URL_IN, workId: WORK_ID, confirmed: true };

  it("沒勾「這是我寫的文章」→ invalid，不抓不寫", async () => {
    const deps = makeDeps();
    await expect(commitImport(deps, "user-1", { ...input, confirmed: false })).resolves.toEqual({
      status: "invalid",
      error: "請勾選「這是我寫的文章」",
    });
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it("沒選作品或作品不存在 → invalid", async () => {
    await expect(commitImport(makeDeps(), "user-1", { ...input, workId: null })).resolves.toMatchObject({ status: "invalid", error: "請先選定作品" });
    const repo = makeRepo({ workExists: vi.fn().mockResolvedValue(false) });
    await expect(commitImport(makeDeps({ repo }), "user-1", input)).resolves.toMatchObject({ status: "invalid", error: "找不到這部作品" });
  });

  it("server 重抓原文寫入：筆名公開、published_at＝原文日期、記原文網址", async () => {
    const deps = makeDeps();
    const outcome = await commitImport(deps, "user-1", input);
    expect(outcome).toEqual({
      status: "imported",
      episodeId: "ep-1",
      article: { title: "《師父》：規矩森嚴的武林", href: "/s/abc123" },
    });
    const row = (deps.repo.insertImported as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(row).toMatchObject({
      userId: "user-1",
      title: "《師父》：規矩森嚴的武林",
      workId: WORK_ID,
      originalUrl: URL_KEY,
      publishedAt: "2015-04-02T02:30:00.000Z",
    });
    expect(row.markdown).toMatch(/^# 《師父》：規矩森嚴的武林\n\n徐浩峰的武林/);
    expect(row.plainText).toContain("規矩是一把刀");
    expect(deps.guessLlm).not.toHaveBeenCalled();
  });

  it("原文沒有日期 → published_at 用今天", async () => {
    const html = HTML.replace(/<meta property="article:published_time"[^>]*>/, "").replace(/<time[^>]*>[^<]*<\/time>/, "");
    const deps = makeDeps({ fetchPage: vi.fn().mockResolvedValue({ html, finalUrl: URL_KEY }) });
    await commitImport(deps, "user-1", input);
    expect((deps.repo.insertImported as ReturnType<typeof vi.fn>).mock.calls[0][0].publishedAt).toBe("2026-10-14T02:00:00.000Z");
  });

  it("已搬過（事前查到或寫入時撞唯一索引）→ duplicate", async () => {
    const found = makeRepo({ findImported: vi.fn().mockResolvedValue({ title: "師父", shareSlug: "abc123" }) });
    await expect(commitImport(makeDeps({ repo: found }), "user-1", input)).resolves.toMatchObject({ status: "duplicate" });

    const { DuplicateImportError } = await import("./service");
    const findImported = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ title: "師父", shareSlug: "zzz" });
    const raced = makeRepo({ findImported, insertImported: vi.fn().mockRejectedValue(new DuplicateImportError()) });
    await expect(commitImport(makeDeps({ repo: raced }), "user-1", input)).resolves.toEqual({
      status: "duplicate",
      existing: { title: "師父", href: "/s/zzz" },
    });
  });
});
