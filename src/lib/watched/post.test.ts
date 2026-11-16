import { describe, expect, it } from "vitest";
import { composePost, formatStars, nextRating, isPostTooLong, postLength, workPageUrl, WATCHED_THREADS_MAX_CHARS } from "./post";

describe("formatStars", () => {
  it.each([
    [0.5, "½"],
    [3, "★★★"],
    [4.5, "★★★★½"],
    [5, "★★★★★"],
  ])("%s → %s", (rating, expected) => {
    expect(formatStars(rating)).toBe(expected);
  });
});

describe("workPageUrl", () => {
  it("去掉 origin 尾斜線、slug 編碼", () => {
    expect(workPageUrl("https://castflow.daydreamdex.com/", "海街日記-2015")).toBe(
      `https://castflow.daydreamdex.com/works/${encodeURIComponent("海街日記-2015")}`,
    );
  });
});

describe("composePost", () => {
  it("預設只有本文＋連結", () => {
    expect(composePost({ body: " 好安靜。 ", rating: 4.5, includeRating: false, link: "https://x/works/a" })).toBe(
      "好安靜。\n\nhttps://x/works/a",
    );
  });

  it("勾了星等才加；沒打星就不加", () => {
    expect(composePost({ body: "好安靜。", rating: 4.5, includeRating: true, link: null })).toBe("好安靜。\n\n★★★★½");
    expect(composePost({ body: "好安靜。", rating: null, includeRating: true, link: null })).toBe("好安靜。");
  });
});

describe("postLength", () => {
  it("Threads 算法：每個字元一個", () => {
    expect(postLength("好看😭\n")).toBe(4);
    expect(isPostTooLong("字".repeat(WATCHED_THREADS_MAX_CHARS))).toBe(false);
    expect(isPostTooLong("字".repeat(WATCHED_THREADS_MAX_CHARS + 1))).toBe(true);
  });
});

describe("nextRating", () => {
  it("點第 n 顆、再點變半顆、再點回 n", () => {
    expect(nextRating(null, 4)).toBe(4);
    expect(nextRating(4, 4)).toBe(3.5);
    expect(nextRating(3.5, 4)).toBe(4);
    expect(nextRating(1, 1)).toBe(0.5);
    expect(nextRating(4.5, 2)).toBe(2);
  });
});
