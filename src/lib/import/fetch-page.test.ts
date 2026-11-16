import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureBasePath, fixturePageFetcher } from "./fetch-page";

const DIR = join(__dirname, "__fixtures__");

describe("fixtureBasePath（E2E 用）", () => {
  it("網址對應到 <目錄>/<host>/<path>", () => {
    expect(fixtureBasePath("/tmp/fx", new URL("https://blog.example.com/2015/04/master"))).toBe(
      resolve("/tmp/fx/blog.example.com/2015/04/master"),
    );
    expect(fixtureBasePath("/tmp/fx", new URL("https://blog.example.com/"))).toBe(resolve("/tmp/fx/blog.example.com/index"));
  });

  it("怪字元或編碼過的 .. 一律拒絕", () => {
    expect(fixtureBasePath("/tmp/fx", new URL("https://blog.example.com/a%2F..%2F..%2Fetc"))).toBeNull();
    expect(fixtureBasePath("/tmp/fx", new URL("https://blog.example.com/a b"))).toBeNull();
  });
});

describe("fixturePageFetcher", () => {
  it("讀得到檔案回 HTML；沒有檔案當成 404", async () => {
    const fetcher = fixturePageFetcher(DIR);
    await expect(fetcher(new URL("https://nowhere.example.com/x"))).rejects.toThrow("來源回應 404");
  });
});
