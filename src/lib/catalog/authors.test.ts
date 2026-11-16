import { describe, expect, it } from "vitest";
import { buildAuthorRows } from "./authors";

describe("buildAuthorRows（作者依最近一篇排序、不排名）", () => {
  const rows = buildAuthorRows([
    { penName: "林小晴", publishedAt: "2026-10-01T00:00:00Z" },
    { penName: "阿哲", publishedAt: "2026-10-10T02:00:00Z" },
    { penName: "林小晴", publishedAt: "2026-10-08T02:00:00Z" },
  ]);
  it("依最近一篇由新到舊", () => {
    expect(rows.map((row) => row.penName)).toEqual(["阿哲", "林小晴"]);
  });
  it("篇數＋日期都用阿拉伯數字", () => {
    expect(rows[1]).toMatchObject({ count: 2, meta: "2 篇・最近一篇 10.08" });
    expect(rows[0].meta).toBe("1 篇・最近一篇 10.10");
  });
  it("空輸入回空陣列", () => {
    expect(buildAuthorRows([])).toEqual([]);
  });
});

describe("buildAuthorRows 帶專欄名", () => {
  const articles = [
    { penName: "林小晴", publishedAt: "2026-10-08T02:00:00Z" },
    { penName: "阿哲", publishedAt: "2026-10-10T02:00:00Z" },
  ];
  it("有取專欄名的作者帶上；沒取的是 null（不給預設名）", () => {
    const rows = buildAuthorRows(articles, new Map([["林小晴", "公車上的散場"]]));
    expect(rows.map((row) => [row.penName, row.columnName])).toEqual([
      ["阿哲", null],
      ["林小晴", "公車上的散場"],
    ]);
  });
  it("不傳專欄名時一律 null", () => {
    expect(buildAuthorRows(articles).every((row) => row.columnName === null)).toBe(true);
  });
});
