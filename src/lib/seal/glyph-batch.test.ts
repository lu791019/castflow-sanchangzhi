import { describe, expect, it, vi } from "vitest";
import { createGlyphBatcher } from "./glyph-batch";

describe("createGlyphBatcher", () => {
  it("同一輪的筆名併成一次查詢", async () => {
    const load = vi.fn(async (names: readonly string[]) => new Map(names.map((name) => [name, name === "阿念" ? "念" : null])));
    const batcher = createGlyphBatcher(load);
    const results = await Promise.all([batcher.load("阿念"), batcher.load("小樹"), batcher.load("阿念")]);
    expect(results).toEqual(["念", null, "念"]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0]).toEqual(["阿念", "小樹"]);
  });

  it("查過的筆名不再查", async () => {
    const load = vi.fn(async (names: readonly string[]) => new Map(names.map((name) => [name, null])));
    const batcher = createGlyphBatcher(load);
    await batcher.load("阿念");
    await Promise.all([batcher.load("阿念"), batcher.load("小樹")]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1][0]).toEqual(["小樹"]);
  });

  it("查詢失敗時回 null（印章退回規則字），不擋畫面", async () => {
    const batcher = createGlyphBatcher(async () => {
      throw new Error("boom");
    });
    await expect(batcher.load("阿念")).resolves.toBeNull();
  });

  it("空筆名直接回 null，不查", async () => {
    const load = vi.fn(async () => new Map<string, string | null>());
    await expect(createGlyphBatcher(load).load("")).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
