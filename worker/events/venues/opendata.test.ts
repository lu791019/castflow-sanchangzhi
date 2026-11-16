import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateCollectedEvent } from "../../../src/lib/events/collected.ts";
import { firstPictureUrl, parseNmmbaExhibitions, parseNmnsExhibitions } from "./opendata.ts";

const FIXTURES = path.join(__dirname, "..", "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");

describe("科博館特展開放資料", () => {
  const events = parseNmnsExhibitions(fixture("nmns", "list.json"));

  it("每筆都收（特展都有起訖、跨度都在 400 天內），場地寫館名", () => {
    expect(events).toHaveLength(8);
    expect(events[2]).toEqual({
      source: "nmns",
      sourceId: "000609",
      title: "微光寄旅-第九屆科學攝影展",
      category: "exhibition",
      venue: "國立自然科學博物館",
      city: "臺中市",
      startsOn: "2026-06-18",
      endsOn: "2027-03-28",
      showTimes: [],
      ticketUrls: [],
      // 圖檔 CORP same-site，別站嵌不了 → 不存
      imageUrl: null,
      sourceUrl: "https://www.nmns.edu.tw/ch/exhibitions/special-exhibitions/Exhibition-000609/",
    });
    expect(events.every((event) => validateCollectedEvent(event) !== null)).toBe(true);
  });

  it("壞資料丟錯；壞的單筆跳過", () => {
    expect(() => parseNmnsExhibitions("<html>error</html>")).toThrow(/科博館.*JSON/);
    expect(() => parseNmnsExhibitions('{"success":false}')).toThrow(/itemList/);
    const body = JSON.stringify({ itemList: [{ title: "沒有網址", dateStart: "2026/01/01", dateEnd: "2026/02/01" }, null, { title: "壞日期", dateStart: "2026/13/01", dateEnd: "2026/12/01", url: "https://www.nmns.edu.tw/x/" }] });
    expect(parseNmnsExhibitions(body)).toEqual([]);
  });
});

describe("海生館特展開放資料", () => {
  const events = parseNmmbaExhibitions(fixture("nmmba", "list.json"));

  it("民國日期解析；沒有日期、沒有結束日、跨度超過 400 天（南藍繫語 3 年半、海盜傳說 15 個月）的不收", () => {
    expect(events.map((event) => [event.title, event.startsOn, event.endsOn])).toEqual([
      ["《海洋性別變奏曲》特展", "2026-06-18", "2027-03-01"],
      ["重返海洋特展", "2025-12-04", "2026-12-31"],
    ]);
  });

  it("場地、城市、圖、官網頁", () => {
    expect(events[0]).toMatchObject({
      source: "nmmba",
      sourceId: "AE0B0E0EEC836122",
      venue: "國立海洋生物博物館",
      city: "屏東縣",
      imageUrl: "https://ws.nmmba.gov.tw/001/Upload/217/relpic/6416/14563/2b04823f-b2a1-4cb6-ae2a-4bd957a94d4a.jpg",
      sourceUrl: "https://www.nmmba.gov.tw/News_Content.aspx?n=3BA711487C292039&s=AE0B0E0EEC836122",
    });
    expect(events.every((event) => validateCollectedEvent(event) !== null)).toBe(true);
  });

  it("圖片欄位：說明裡有括號也取得到網址；沒有圖回 null", () => {
    expect(firstPictureUrl("記者會帆布 高270 x 寬440cm(自行放大)(https://ws.nmmba.gov.tw/a/b.jpg),")).toBe("https://ws.nmmba.gov.tw/a/b.jpg");
    expect(firstPictureUrl("")).toBeNull();
  });

  it("巡迴到別館：用那個館當場地", () => {
    const body = JSON.stringify([
      { 特展名稱: "印象海洋攝影展", 展出地點: "國立台灣博物館", app用開始時間: "1151001", app用結束時間: "1151231", 相關圖片: "", Source: "https://www.nmmba.gov.tw/News_Content.aspx?n=1&s=X" },
    ]);
    expect(parseNmmbaExhibitions(body)[0]).toMatchObject({ venue: "國立台灣博物館", city: null, startsOn: "2026-10-01" });
  });

  it("不是陣列丟錯", () => {
    expect(() => parseNmmbaExhibitions('{"a":1}')).toThrow(/海生館/);
  });
});
