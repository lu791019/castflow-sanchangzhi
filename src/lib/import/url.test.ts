import { describe, expect, it } from "vitest";
import { displayDomain, normalizeArticleUrl } from "./url";

describe("normalizeArticleUrl", () => {
  it("去掉追蹤參數、# 與結尾斜線，host 小寫，http 升 https", () => {
    const result = normalizeArticleUrl(" http://Blog.Example.com/2015/04/master/?utm_source=fb&fbclid=x#comments ");
    expect(result).toEqual({ ok: true, value: "https://blog.example.com/2015/04/master" });
  });

  it("保留有意義的 query 並排序，同一篇不同寫法得到同一個鍵", () => {
    const a = normalizeArticleUrl("https://example.com/post.php?p=12&lang=zh&utm_medium=x");
    const b = normalizeArticleUrl("https://EXAMPLE.com/post.php?lang=zh&p=12");
    expect(a).toEqual({ ok: true, value: "https://example.com/post.php?lang=zh&p=12" });
    expect(b).toEqual(a);
  });

  it("根目錄保留斜線、預設埠拿掉", () => {
    expect(normalizeArticleUrl("https://example.com:443/")).toEqual({ ok: true, value: "https://example.com/" });
  });

  it("沒寫協定時補 https", () => {
    expect(normalizeArticleUrl("medium.com/@dex/my-post")).toEqual({ ok: true, value: "https://medium.com/@dex/my-post" });
  });

  it("空白、格式錯、非網頁協定、內網、帳密、特殊埠都擋", () => {
    expect(normalizeArticleUrl("   ")).toEqual({ ok: false, error: "請貼上文章網址" });
    expect(normalizeArticleUrl("ht!tp://")).toMatchObject({ ok: false });
    expect(normalizeArticleUrl("ftp://example.com/a")).toEqual({ ok: false, error: "請貼 https 開頭的文章網址" });
    expect(normalizeArticleUrl("https://localhost/a")).toEqual({ ok: false, error: "這個網址抓不到文章" });
    expect(normalizeArticleUrl("https://192.168.1.2/a")).toEqual({ ok: false, error: "這個網址抓不到文章" });
    expect(normalizeArticleUrl("https://u:p@example.com/a")).toEqual({ ok: false, error: "文章網址不能帶帳號密碼" });
    expect(normalizeArticleUrl("https://example.com:8443/a")).toEqual({ ok: false, error: "文章網址不收特殊連接埠" });
  });

  it("太長擋下", () => {
    expect(normalizeArticleUrl(`https://example.com/${"a".repeat(2100)}`)).toEqual({
      ok: false,
      error: "文章網址太長了",
    });
  });
});

describe("displayDomain", () => {
  it("去掉 www.，其他子網域保留", () => {
    expect(displayDomain("https://www.example.com/a")).toBe("example.com");
    expect(displayDomain("https://dex.blogspot.com/a")).toBe("dex.blogspot.com");
  });

  it("格式錯回 null", () => {
    expect(displayDomain("not a url")).toBeNull();
  });
});
