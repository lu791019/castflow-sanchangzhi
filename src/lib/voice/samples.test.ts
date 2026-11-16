import { describe, expect, it } from "vitest";
import {
  isUsableSpokenSample,
  MAX_SAMPLE_CHARS,
  parsePastedSample,
  pickPromptSamples,
  type VoiceSample,
} from "./samples";

function sample(id: string, source: VoiceSample["source"], body: string, created_at: string): VoiceSample {
  return { id, source, body, created_at };
}

describe("parsePastedSample", () => {
  it("去頭尾空白", () => {
    expect(parsePastedSample("  " + "看".repeat(20) + "  ")).toEqual({ ok: true, value: "看".repeat(20) });
  });

  it.each([
    [3, "請貼上文字"],
    ["太短", "太短"],
    ["字".repeat(MAX_SAMPLE_CHARS + 1), "太長"],
  ])("拒絕 %#", (input, message) => {
    const result = parsePastedSample(input);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(message);
  });
});

describe("isUsableSpokenSample", () => {
  it("20 字以上才收", () => {
    expect(isUsableSpokenSample("嗯".repeat(19))).toBe(false);
    expect(isUsableSpokenSample("嗯".repeat(20))).toBe(true);
  });
});

describe("pickPromptSamples", () => {
  const samples = [
    sample("s1", "spoken", "說過的話".repeat(10), "2026-10-26T10:00:00Z"),
    sample("p1", "paste", "舊的貼文".repeat(10), "2026-10-01T10:00:00Z"),
    sample("p2", "paste", "新的貼文".repeat(10), "2026-10-20T10:00:00Z"),
  ];

  it("自己貼的優先、同來源新的先，再補說過的話", () => {
    expect(pickPromptSamples(samples)).toEqual([samples[2].body, samples[1].body, samples[0].body]);
  });

  it("最多 count 篇", () => {
    expect(pickPromptSamples(samples, 2)).toHaveLength(2);
  });

  it("超過字數預算的跳過，第一篇過長截到預算", () => {
    expect(pickPromptSamples(samples, 3, 70)).toEqual([samples[2].body]);
    expect(pickPromptSamples([sample("x", "paste", "長".repeat(100), "2026-10-01T00:00:00Z")], 3, 10)).toEqual(["長".repeat(10)]);
  });

  it("沒有樣本回空陣列（走通用語氣）", () => {
    expect(pickPromptSamples([])).toEqual([]);
  });
});
