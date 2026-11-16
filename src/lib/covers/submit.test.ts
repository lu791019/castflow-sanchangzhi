import { describe, expect, it, vi } from "vitest";
import { submitCover, type CoverSubmitDeps } from "./submit";

const OWN = "http://127.0.0.1:54321/storage/v1/object/public/covers/";
const JPG = { ext: "jpg", contentType: "image/jpeg" } as const;

function deps(overrides: Partial<CoverSubmitDeps> = {}): CoverSubmitDeps {
  return {
    ownPrefix: OWN,
    download: vi.fn(async () => ({ bytes: new Uint8Array([1]), type: JPG, hosts: ["image.tmdb.org"] })),
    store: vi.fn(async () => `${OWN}u/new.jpg`),
    insertSubmission: vi.fn(async () => "sub-1"),
    fillEmptyPoster: vi.fn(async () => true),
    warn: vi.fn(),
    ...overrides,
  };
}

const base = { workId: "w-1", userId: "u-1" };

describe("submitCover", () => {
  it("白名單網址：轉存自家桶、記 approved、補空的 poster_url", async () => {
    const d = deps();
    const result = await submitCover(d, { ...base, url: "https://image.tmdb.org/t/p/a.jpg" });
    expect(result).toEqual({ ok: true, status: "approved", submissionId: "sub-1", posterUrl: `${OWN}u/new.jpg` });
    expect(d.insertSubmission).toHaveBeenCalledWith({ ...base, url: `${OWN}u/new.jpg`, source: "url", status: "approved" });
    expect(d.fillEmptyPoster).toHaveBeenCalledWith("w-1", `${OWN}u/new.jpg`);
    expect(d.warn).not.toHaveBeenCalled();
  });

  it("白名單網址但作品已有封面：approved、不覆蓋，posterUrl 為 null", async () => {
    const d = deps({ fillEmptyPoster: vi.fn(async () => false) });
    const result = await submitCover(d, { ...base, url: "https://image.tmdb.org/t/p/a.jpg" });
    expect(result).toMatchObject({ ok: true, status: "approved", posterUrl: null });
  });

  it("白名單外網址：轉存後記 pending、推警報（含 work、user、網址），不寫 poster_url", async () => {
    const d = deps({ download: vi.fn(async () => ({ bytes: new Uint8Array([1]), type: JPG, hosts: ["example.com"] })) });
    const result = await submitCover(d, { ...base, url: "https://example.com/a.jpg" });
    expect(result).toEqual({ ok: true, status: "pending", submissionId: "sub-1" });
    expect(d.fillEmptyPoster).not.toHaveBeenCalled();
    expect(d.warn).toHaveBeenCalledWith(
      "有人補了白名單外的封面，待審",
      expect.stringContaining("work=w-1 user=u-1 url=https://example.com/a.jpg"),
    );
  });

  it("自家桶網址（上傳）：不下載、記 upload／pending、推警報", async () => {
    const d = deps();
    const result = await submitCover(d, { ...base, url: `${OWN}u/abc.png` });
    expect(result).toMatchObject({ ok: true, status: "pending" });
    expect(d.download).not.toHaveBeenCalled();
    expect(d.store).not.toHaveBeenCalled();
    expect(d.insertSubmission).toHaveBeenCalledWith({ ...base, url: `${OWN}u/abc.png`, source: "upload", status: "pending" });
    expect(d.warn).toHaveBeenCalledTimes(1);
  });

  it("網址不合法（http、內網）：invalid，不下載", async () => {
    const d = deps();
    expect(await submitCover(d, { ...base, url: "https://169.254.169.254/x" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await submitCover(d, { ...base, url: "http://example.com/a.jpg" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(d.download).not.toHaveBeenCalled();
  });

  it("下載失敗：推警報、回 fetch_failed，不寫任何東西", async () => {
    const d = deps({ download: vi.fn(async () => Promise.reject(new Error("下載封面逾時"))) });
    const result = await submitCover(d, { ...base, url: "https://image.tmdb.org/t/p/a.jpg" });
    expect(result).toMatchObject({ ok: false, reason: "fetch_failed" });
    expect(d.warn).toHaveBeenCalledWith("場刊封面下載失敗", expect.stringContaining("下載封面逾時"));
    expect(d.insertSubmission).not.toHaveBeenCalled();
  });
});
