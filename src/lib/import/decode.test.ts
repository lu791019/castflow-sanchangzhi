import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeHtml, isHtmlContentType } from "./decode";

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "__fixtures__", name)));

describe("decodeHtml", () => {
  it("預設 UTF-8", () => {
    expect(decodeHtml(new TextEncoder().encode("<p>散場之後</p>"), "text/html")).toBe("<p>散場之後</p>");
  });

  it("Content-Type 的 charset 優先", () => {
    const html = decodeHtml(fixture("big5.html"), "text/html; charset=Big5");
    expect(html).toContain("樹大招風拍的是三個大賊的故事");
  });

  it("header 沒寫時看 <meta> 宣告", () => {
    const html = decodeHtml(fixture("big5.html"), "text/html");
    expect(html).toContain("九七之前的香港");
  });

  it("不認得的編碼退回 UTF-8", () => {
    expect(decodeHtml(new TextEncoder().encode("<p>好</p>"), "text/html; charset=x-unknown")).toBe("<p>好</p>");
  });
});

describe("isHtmlContentType", () => {
  it("只收 HTML（沒給 Content-Type 也放行，交給抽取判斷）", () => {
    expect(isHtmlContentType("text/html; charset=utf-8")).toBe(true);
    expect(isHtmlContentType("application/xhtml+xml")).toBe(true);
    expect(isHtmlContentType(null)).toBe(true);
    expect(isHtmlContentType("application/pdf")).toBe(false);
    expect(isHtmlContentType("image/jpeg")).toBe(false);
  });
});
