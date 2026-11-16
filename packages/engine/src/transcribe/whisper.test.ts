import { describe, expect, it } from "vitest";
import { toTranscriptionResult } from "./whisper";

describe("toTranscriptionResult（Groq verbose_json 正規化）", () => {
  it("語言全名轉 ISO 碼，英文分段之間保留空白", () => {
    const result = toTranscriptionResult({
      text: "I'm David SangerI cover the White House",
      language: "English",
      segments: [
        { start: 0, end: 2.24, text: " I'm David Sanger" },
        { start: 2.24, end: 5.84, text: " I cover the White House" },
      ],
    });
    expect(result.language).toBe("en");
    expect(result.fullText).toBe("I'm David Sanger I cover the White House");
    expect(result.segments).toEqual([
      { start: 0, end: 2.24, text: "I'm David Sanger" },
      { start: 2.24, end: 5.84, text: "I cover the White House" },
    ]);
  });

  it("中文分段直接相接", () => {
    const result = toTranscriptionResult({
      text: "",
      language: "chinese",
      segments: [
        { start: 0, end: 1, text: "大家好，" },
        { start: 1, end: 2, text: "今天聊轉錄。" },
      ],
    });
    expect(result.language).toBe("zh");
    expect(result.fullText).toBe("大家好，今天聊轉錄。");
  });

  it("無 segments 時退回 text，過濾畸形與空白段", () => {
    expect(
      toTranscriptionResult({ text: " hello world ", language: "en" }).fullText,
    ).toBe("hello world");
    const result = toTranscriptionResult({
      text: "x",
      segments: [{ start: 0, end: 1, text: "   " }, { start: "a" }, null],
    });
    expect(result.segments).toEqual([]);
    expect(result.language).toBe("unknown");
  });
});
