import { describe, expect, it } from "vitest";
import {
  COLUMN_NAME_MAX_LENGTH,
  columnLabel,
  normalizeColumnName,
  parseColumnName,
  resolveColumnName,
  withColumnName,
} from "./column-name";

describe("normalizeColumnName：去頭尾空白、內部空白收成一格", () => {
  it("去頭尾空白（含全形空白）", () => {
    expect(normalizeColumnName("  公車上的散場　")).toBe("公車上的散場");
  });

  it("內部連續空白收成一格", () => {
    expect(normalizeColumnName("Subtitles   Off")).toBe("Subtitles Off");
  });

  it("貼上「專欄｜」前綴時拿掉（畫面會自己加）", () => {
    expect(normalizeColumnName("專欄｜公車上的散場")).toBe("公車上的散場");
    expect(normalizeColumnName("專欄| 公車上的散場")).toBe("公車上的散場");
  });
});

describe("parseColumnName：server 端驗證", () => {
  it("null／undefined／空字串／全空白＝不取專欄名", () => {
    expect(parseColumnName(null)).toEqual({ ok: true, value: null });
    expect(parseColumnName(undefined)).toEqual({ ok: true, value: null });
    expect(parseColumnName("")).toEqual({ ok: true, value: null });
    expect(parseColumnName("  　 ")).toEqual({ ok: true, value: null });
    expect(parseColumnName("專欄｜")).toEqual({ ok: true, value: null });
  });

  it("正規化後存", () => {
    expect(parseColumnName(" 公車上的散場 ")).toEqual({ ok: true, value: "公車上的散場" });
  });

  it("非字串拒絕", () => {
    expect(parseColumnName(42)).toEqual({ ok: false, error: "專欄名格式不對" });
    expect(parseColumnName({ value: "x" })).toEqual({ ok: false, error: "專欄名格式不對" });
  });

  it("上限 20 字，以 code point 計（與 Postgres char_length 一致）", () => {
    expect(COLUMN_NAME_MAX_LENGTH).toBe(20);
    expect(parseColumnName("字".repeat(20))).toEqual({ ok: true, value: "字".repeat(20) });
    expect(parseColumnName("字".repeat(21))).toEqual({ ok: false, error: "專欄名最多 20 個字" });
    expect(parseColumnName("🎬".repeat(20))).toEqual({ ok: true, value: "🎬".repeat(20) });
  });

  it("換行、tab 等控制字元拒絕", () => {
    expect(parseColumnName("公車上\n的散場")).toEqual({ ok: false, error: "專欄名不能有換行或特殊控制字元" });
    expect(parseColumnName("公車\t散場")).toEqual({ ok: false, error: "專欄名不能有換行或特殊控制字元" });
  });
});

describe("resolveColumnName：讀出來的值", () => {
  it("有值照用，空的或不合規則當沒取", () => {
    expect(resolveColumnName("公車上的散場")).toBe("公車上的散場");
    expect(resolveColumnName(null)).toBeNull();
    expect(resolveColumnName(undefined)).toBeNull();
    expect(resolveColumnName("  ")).toBeNull();
  });
});

describe("columnLabel：刊頭「專欄｜…」", () => {
  it("有專欄名才有這一行；沒有就 null（不給預設名）", () => {
    expect(columnLabel("公車上的散場")).toBe("專欄｜公車上的散場");
    expect(columnLabel(null)).toBeNull();
  });
});

describe("withColumnName：作者列的副標", () => {
  it("專欄名接在前面；沒有就只留原本的", () => {
    expect(withColumnName("公車上的散場", "12篇")).toBe("公車上的散場・12篇");
    expect(withColumnName(null, "12篇")).toBe("12篇");
  });
});
