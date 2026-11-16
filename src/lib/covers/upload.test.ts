import { describe, expect, it } from "vitest";
import { COVER_MAX_BYTES, parseCoverUrl, sniffImageType, validateCoverUpload } from "./upload";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);

describe("sniffImageType：看檔頭，不信副檔名與 Content-Type", () => {
  it("認得 jpg / png / webp", () => {
    expect(sniffImageType(JPG)).toEqual({ ext: "jpg", contentType: "image/jpeg" });
    expect(sniffImageType(PNG)).toEqual({ ext: "png", contentType: "image/png" });
    expect(sniffImageType(WEBP)).toEqual({ ext: "webp", contentType: "image/webp" });
  });
  it("其他（gif、太短）回 null", () => {
    expect(sniffImageType(GIF)).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateCoverUpload", () => {
  it("合格回類型", () => {
    expect(validateCoverUpload(PNG, PNG.length)).toEqual({ ok: true, value: { ext: "png", contentType: "image/png" } });
  });
  it("空檔、超過 3MB、非圖片都擋", () => {
    expect(validateCoverUpload(new Uint8Array(), 0)).toEqual({ ok: false, error: "沒有收到圖片" });
    expect(validateCoverUpload(PNG, COVER_MAX_BYTES + 1)).toEqual({ ok: false, error: "圖片不可超過 3MB" });
    expect(validateCoverUpload(GIF, GIF.length)).toEqual({ ok: false, error: "只收 JPG、PNG、WebP 圖片" });
  });
});

describe("parseCoverUrl：記一筆場外的「封面」網址", () => {
  it("沒填、空白 → null", () => {
    expect(parseCoverUrl(undefined)).toEqual({ ok: true, value: null });
    expect(parseCoverUrl("  ")).toEqual({ ok: true, value: null });
  });
  it("https 網址通過並去空白", () => {
    expect(parseCoverUrl(" https://img.example.com/a.jpg ")).toEqual({ ok: true, value: "https://img.example.com/a.jpg" });
  });
  it("外部 http 不收（混合內容、明碼）；自家 Storage 網址（本地是 http）照收", () => {
    const storage = "http://127.0.0.1:54321/storage/v1/object/public/covers/";
    expect(parseCoverUrl("http://img.example.com/a.jpg", storage)).toEqual({ ok: false, error: "封面網址要是 https 開頭" });
    expect(parseCoverUrl(`${storage}u/x.png`, storage)).toEqual({ ok: true, value: `${storage}u/x.png` });
  });
  it("非文字、非 http(s)、太長都擋", () => {
    expect(parseCoverUrl(3)).toEqual({ ok: false, error: "封面網址必須是文字" });
    expect(parseCoverUrl("javascript:alert(1)")).toEqual({ ok: false, error: "封面網址要是 https 開頭" });
    expect(parseCoverUrl(`https://a.example/${"x".repeat(2000)}`)).toEqual({ ok: false, error: "封面網址不可超過 2000 字" });
  });
});
