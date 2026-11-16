import { describe, expect, it } from "vitest";
import { buildMlxArgs, parseMlxResult } from "./mlx.ts";

describe("buildMlxArgs", () => {
  it("組出 json 輸出與模型參數", () => {
    const args = buildMlxArgs("/tmp/a.mp3", "out-1", {
      model: "mlx-community/whisper-medium-mlx-q4",
      outputDir: "/tmp/out",
    });
    expect(args[0]).toBe("/tmp/a.mp3");
    expect(args).toContain("--model");
    expect(args).toContain("mlx-community/whisper-medium-mlx-q4");
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
    expect(args).toContain("--output-name");
    expect(args).toContain("out-1");
  });
});

describe("parseMlxResult", () => {
  it("解析 text/segments/language 並修剪空白", () => {
    const raw = JSON.stringify({
      text: "  hello world  ",
      language: "en",
      segments: [
        { id: 0, seek: 0, start: 0, end: 2.5, text: " hello ", tokens: [1] },
        { id: 1, seek: 0, start: 2.5, end: 5, text: " world ", tokens: [2] },
      ],
    });
    const result = parseMlxResult(raw);
    expect(result.fullText).toBe("hello world");
    expect(result.language).toBe("en");
    expect(result.segments).toEqual([
      { start: 0, end: 2.5, text: "hello" },
      { start: 2.5, end: 5, text: "world" },
    ]);
  });

  it("過濾畸形 segment、缺 language 時補 unknown", () => {
    const raw = JSON.stringify({
      text: "ok",
      segments: [{ start: "bad", end: 1, text: "x" }, { start: 0, end: 1, text: "good" }],
    });
    const result = parseMlxResult(raw);
    expect(result.segments).toEqual([{ start: 0, end: 1, text: "good" }]);
    expect(result.language).toBe("unknown");
  });

  it("非 JSON 或缺 text 時擲錯", () => {
    expect(() => parseMlxResult("not-json")).toThrow(/合法 JSON/);
    expect(() => parseMlxResult(JSON.stringify({ segments: [] }))).toThrow(/text/);
    expect(() => parseMlxResult(JSON.stringify({ text: "   " }))).toThrow(/text/);
  });
});
