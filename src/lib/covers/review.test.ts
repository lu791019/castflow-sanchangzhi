import { describe, expect, it, vi } from "vitest";
import { parseReviewArgs, reviewCoverSubmission, storagePathOf, type ReviewDeps } from "./review";

const ID = "8f8c6c5e-4a8e-4d55-9f7a-0a1b2c3d4e5f";
const PREFIX = "https://x.supabase.co/storage/v1/object/public/covers/";

describe("parseReviewArgs", () => {
  it("--approve / --reject 帶 uuid", () => {
    expect(parseReviewArgs(["--approve", ID])).toEqual({ ok: true, value: { action: "approve", id: ID } });
    expect(parseReviewArgs(["--reject", ID])).toEqual({ ok: true, value: { action: "reject", id: ID } });
  });

  it("沒參數或 --list → 列出待審", () => {
    expect(parseReviewArgs([])).toEqual({ ok: true, value: { action: "list" } });
    expect(parseReviewArgs(["--list"])).toEqual({ ok: true, value: { action: "list" } });
  });

  it("id 不是 uuid、未知旗標 → 錯誤", () => {
    expect(parseReviewArgs(["--approve", "abc"]).ok).toBe(false);
    expect(parseReviewArgs(["--approve"]).ok).toBe(false);
    expect(parseReviewArgs(["--delete", ID]).ok).toBe(false);
  });
});

describe("storagePathOf", () => {
  it("自家桶網址 → 桶內路徑；外部網址 → null", () => {
    expect(storagePathOf(`${PREFIX}u/abc.jpg`, PREFIX)).toBe("u/abc.jpg");
    expect(storagePathOf("https://example.com/u/abc.jpg", PREFIX)).toBeNull();
    expect(storagePathOf(`${PREFIX}../x`, PREFIX)).toBeNull();
  });
});

function deps(overrides: Partial<ReviewDeps> = {}): ReviewDeps {
  return {
    findPending: vi.fn(async () => ({ id: ID, workId: "w-1", url: `${PREFIX}u/abc.jpg` })),
    setStatus: vi.fn(async () => undefined),
    fillEmptyPoster: vi.fn(async () => true),
    removeObject: vi.fn(async () => undefined),
    publicPrefix: PREFIX,
    ...overrides,
  };
}

describe("reviewCoverSubmission", () => {
  it("approve：改 approved 並補空的 poster_url", async () => {
    const d = deps();
    expect(await reviewCoverSubmission(d, "approve", ID)).toEqual({ ok: true, message: "已通過，場刊封面已換上" });
    expect(d.setStatus).toHaveBeenCalledWith(ID, "approved");
    expect(d.fillEmptyPoster).toHaveBeenCalledWith("w-1", `${PREFIX}u/abc.jpg`);
    expect(d.removeObject).not.toHaveBeenCalled();
  });

  it("approve 但場刊已有封面：通過、不覆蓋", async () => {
    const d = deps({ fillEmptyPoster: vi.fn(async () => false) });
    expect(await reviewCoverSubmission(d, "approve", ID)).toEqual({ ok: true, message: "已通過；場刊已有封面，未覆蓋" });
  });

  it("reject：改 rejected 並刪掉桶裡的檔", async () => {
    const d = deps();
    expect((await reviewCoverSubmission(d, "reject", ID)).ok).toBe(true);
    expect(d.setStatus).toHaveBeenCalledWith(ID, "rejected");
    expect(d.removeObject).toHaveBeenCalledWith("u/abc.jpg");
    expect(d.fillEmptyPoster).not.toHaveBeenCalled();
  });

  it("找不到待審的那筆 → 錯誤，不動任何東西", async () => {
    const d = deps({ findPending: vi.fn(async () => null) });
    expect(await reviewCoverSubmission(d, "approve", ID)).toEqual({ ok: false, message: `找不到待審的封面 ${ID}` });
    expect(d.setStatus).not.toHaveBeenCalled();
  });
});
