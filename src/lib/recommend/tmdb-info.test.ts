import { describe, expect, it } from "vitest";
import { parseTmdbInfo } from "./tmdb-info";

describe("parseTmdbInfo", () => {
  it("電影：類型、導演、前幾位演員、recommendations／similar 的 id", () => {
    const info = parseTmdbInfo("movie", {
      genres: [{ id: 18, name: "劇情" }, { id: "x" }],
      credits: {
        crew: [
          { id: 1, name: "阿莫多瓦", job: "Director" },
          { id: 2, name: "某編劇", job: "Writer" },
        ],
        cast: Array.from({ length: 12 }, (_, index) => ({ id: 100 + index, name: `演員${index}` })),
      },
      recommendations: { results: [{ id: 11 }, { id: "壞" }, { id: 12 }] },
      similar: { results: [{ id: 13 }] },
    });
    expect(info.genres).toEqual([{ id: 18, name: "劇情" }]);
    expect(info.directors).toEqual([{ id: 1, name: "阿莫多瓦" }]);
    expect(info.cast).toHaveLength(8);
    expect(info.cast[0]).toEqual({ id: 100, name: "演員0" });
    expect(info.recommendations).toEqual([11, 12]);
    expect(info.similar).toEqual([13]);
  });

  it("影集：主創當導演；缺欄位就給空陣列", () => {
    const info = parseTmdbInfo("series", { created_by: [{ id: 5, name: "主創" }] });
    expect(info).toEqual({ genres: [], directors: [{ id: 5, name: "主創" }], cast: [], recommendations: [], similar: [] });
  });

  it("壞資料不丟錯", () => {
    expect(parseTmdbInfo("movie", {})).toEqual({ genres: [], directors: [], cast: [], recommendations: [], similar: [] });
  });
});
