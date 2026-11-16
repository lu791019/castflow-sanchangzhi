import { describe, expect, it } from "vitest";
import {
  isChineseLanguage,
  joinSegmentTexts,
  normalizeLanguageCode,
} from "./language";

describe("normalizeLanguageCode", () => {
  it("Groq 英文全名 → ISO 碼", () => {
    expect(normalizeLanguageCode("English")).toBe("en");
    expect(normalizeLanguageCode("Chinese")).toBe("zh");
    expect(normalizeLanguageCode("japanese")).toBe("ja");
  });

  it("mlx ISO 碼與地區碼 → 小寫基底碼", () => {
    expect(normalizeLanguageCode("en")).toBe("en");
    expect(normalizeLanguageCode("EN")).toBe("en");
    expect(normalizeLanguageCode("zh-TW")).toBe("zh");
    expect(normalizeLanguageCode("pt_BR")).toBe("pt");
  });

  it("空值或無法辨識 → unknown", () => {
    expect(normalizeLanguageCode(undefined)).toBe("unknown");
    expect(normalizeLanguageCode("")).toBe("unknown");
    expect(normalizeLanguageCode("Klingon language")).toBe("unknown");
  });
});

describe("isChineseLanguage", () => {
  it("中文與粵語不需翻譯", () => {
    expect(isChineseLanguage("zh")).toBe(true);
    expect(isChineseLanguage("zh-TW")).toBe(true);
    expect(isChineseLanguage("Chinese")).toBe(true);
    expect(isChineseLanguage("cantonese")).toBe(true);
  });

  it("其他語言需翻譯", () => {
    expect(isChineseLanguage("en")).toBe(false);
    expect(isChineseLanguage("English")).toBe(false);
    expect(isChineseLanguage("unknown")).toBe(false);
  });
});

describe("joinSegmentTexts", () => {
  it("英文段落之間補空白（修正 SangerI 黏字）", () => {
    expect(
      joinSegmentTexts([" I'm David Sanger", "I cover the White House "]),
    ).toBe("I'm David Sanger I cover the White House");
  });

  it("中文段落直接相接不插空白", () => {
    expect(joinSegmentTexts(["今天聊三件事。", "第一件是轉錄。"])).toBe(
      "今天聊三件事。第一件是轉錄。",
    );
  });

  it("中英混排：CJK 邊界不插空白，拉丁邊界插空白", () => {
    expect(joinSegmentTexts(["我們用 AI", "workflow 來做", "很快"])).toBe(
      "我們用 AI workflow 來做很快",
    );
  });

  it("略過空段", () => {
    expect(joinSegmentTexts(["", "  ", "hello", "world"])).toBe("hello world");
    expect(joinSegmentTexts([])).toBe("");
  });
});
