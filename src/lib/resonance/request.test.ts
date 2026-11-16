import { describe, expect, it } from "vitest";
import { parseResonanceRequest } from "./request";

describe("parseResonanceRequest", () => {
  it("合法", () => {
    expect(parseResonanceRequest({ slug: "abcDEF1234", hash: "0123456789abcdef" })).toEqual({
      ok: true,
      slug: "abcDEF1234",
      hash: "0123456789abcdef",
    });
  });
  it("缺欄位或格式不對", () => {
    expect(parseResonanceRequest(null).ok).toBe(false);
    expect(parseResonanceRequest({ slug: "../x", hash: "0123456789abcdef" }).ok).toBe(false);
    expect(parseResonanceRequest({ slug: "abc", hash: "nothex" }).ok).toBe(false);
    expect(parseResonanceRequest({ slug: "abc" }).ok).toBe(false);
  });
});
