import { describe, expect, it } from "vitest";
import { parseClaimResult } from "./claim";

describe("parseClaimResult", () => {
  it("成功：加總各表筆數", () => {
    expect(
      parseClaimResult({ claimed: true, counts: { episodes: 9, contents: 30, feeds: 0 } }),
    ).toEqual({ claimed: true, total: 39, counts: { episodes: 9, contents: 30, feeds: 0 } });
  });

  it("已被認領", () => {
    expect(parseClaimResult({ claimed: false, reason: "already_claimed" })).toEqual({
      claimed: false,
      reason: "already_claimed",
    });
  });

  it.each([null, "x", { claimed: "yes" }, { claimed: true, counts: { a: "1" } }])(
    "格式不對 %s 視為失敗",
    (value) => {
      expect(parseClaimResult(value)).toEqual({ claimed: false, reason: "invalid_response" });
    },
  );
});
