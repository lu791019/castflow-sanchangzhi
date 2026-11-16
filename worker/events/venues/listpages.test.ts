import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateCollectedEvent } from "../../../src/lib/events/collected.ts";
import { nstmPageUrl, nstmToEvent, parseNstmPage } from "./nstm.ts";
import { parseSongshanPage, songshanPageUrl } from "./songshan.ts";
import { parseTnamPage } from "./tnam.ts";

const FIXTURES = path.join(__dirname, "..", "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");
const valid = (events: unknown[]) => events.every((event) => validateCollectedEvent(event) !== null);

describe("松山文創園區", () => {
  const first = parseSongshanPage(fixture("songshan", "list-1.html"));
  const second = parseSongshanPage(fixture("songshan", "list-2.html"));

  it("輪播＋列表合併去重；只收標題看得出是展覽的（市集、博覽會、攻略、快閃店、VR 體驗不收）", () => {
    expect(first.pages).toBe(2);
    expect(first.events.map((event) => event.title)).toEqual([
      "松菸夜光花園 光影展",
      "釜山・匯流成潮｜國際設計交流展",
      "粹 · 本質 | 2026 年 iF 設計獎獲獎作品展 (V)",
      "《AHA 原來如此！教科書設計展》",
      "淨毒五郎：純淨重生｜日常綠光展",
      "2026 POPUPASIA® 亞洲手創暨生活展",
    ]);
    // 每頁上方都有同一組輪播（精選），列表只在各自那頁；收集流程跨頁再去重
    expect(second.events.map((event) => event.sourceId).sort()).toEqual(first.events.map((event) => event.sourceId).sort());
  });

  it("欄位", () => {
    expect(first.events.find((event) => event.title === "松菸夜光花園 光影展")).toMatchObject({
      source: "songshan",
      sourceId: "07e87658-6bea-4715-b633-5e44cd2d9e30",
      category: "exhibition",
      venue: "松山文創園區",
      city: "臺北市",
      startsOn: "2026-01-31",
      endsOn: "2026-12-31",
      imageUrl: "https://www.songshanculturalpark.org/gallery/1783060163_9706d81259d5cc1398b9.jpg",
      sourceUrl: "https://www.songshanculturalpark.org/exhibition/activity/07e87658-6bea-4715-b633-5e44cd2d9e30",
    });
    expect(valid(first.events)).toBe(true);
  });

  it("翻頁網址；版型不對丟錯", () => {
    expect(songshanPageUrl(1)).toBe("https://www.songshanculturalpark.org/exhibition");
    expect(songshanPageUrl(2)).toBe("https://www.songshanculturalpark.org/exhibition?page=2");
    expect(() => parseSongshanPage("<html>Just a moment...</html>")).toThrow(/松菸/);
  });
});

describe("國立科學工藝博物館", () => {
  const first = parseNstmPage(fixture("nstm", "list-1.html"));
  const third = parseNstmPage(fixture("nstm", "list-3.html"));
  const last = parseNstmPage(fixture("nstm", "list-4.html"));

  it("第 1 頁全是常設展：解析得到但一筆都不收；看得到最後一頁", () => {
    expect(first.rows).toHaveLength(10);
    expect(first.lastPage).toBe(4);
    expect(first.rows[0]).toMatchObject({ title: "希望 · 未來 莫拉克風災紀念廳", startsOn: null, endsOn: null });
    expect(first.rows.flatMap((row) => nstmToEvent(row) ?? [])).toEqual([]);
  });

  it("民國日期；「不定期結束」與跨度超過 400 天（兩三年的親子樂園、唐獎）不收", () => {
    expect(third.rows.find((row) => row.title === "地震體驗屋")).toMatchObject({ startsOn: "2025-06-15", endsOn: null });
    expect(third.rows.flatMap((row) => nstmToEvent(row) ?? [])).toEqual([]);
  });

  it("最後一頁的特展：欄位、圖、官網頁", () => {
    const events = last.rows.flatMap((row) => nstmToEvent(row) ?? []);
    expect(events.map((event) => [event.title, event.startsOn, event.endsOn])).toEqual([
      ["儀相萬千：量測儀器特展", "2026-06-30", "2026-11-15"],
      ["明心:慈濟心靈史詩 | journey to enlightenment特展", "2026-08-01", "2026-11-01"],
      ["船之所向-探索船舶；遊艇與海洋科技的航行展", "2026-09-09", "2026-11-20"],
    ]);
    expect(events[0]).toMatchObject({
      source: "nstm",
      category: "exhibition",
      venue: "國立科學工藝博物館",
      city: "高雄市",
      sourceUrl: expect.stringMatching(/^https:\/\/www\.nstm\.gov\.tw\/Exhibition\.aspx\?KeyID=[\w-]+$/),
      imageUrl: expect.stringMatching(/^https:\/\/www\.nstm\.gov\.tw\/FileHandler\.ashx\?oid=[\w-]+&fid=[\w-]+$/),
    });
    expect(valid(events)).toBe(true);
  });

  it("翻頁網址；版型不對丟錯", () => {
    expect(nstmPageUrl(1)).toBe("https://www.nstm.gov.tw/ExhibitionList.aspx");
    expect(nstmPageUrl(4)).toBe("https://www.nstm.gov.tw/ExhibitionList.aspx?Pindex=4&Period=2");
    expect(() => parseNstmPage("<html></html>")).toThrow(/科工館/);
  });
});

describe("臺南市美術館", () => {
  it("當期：同一檔兩個版面只留一筆；常設級（4 年）不收；中英標題只留中文", () => {
    const events = parseTnamPage(fixture("tnam", "current.html"));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      source: "tnam",
      sourceId: "718",
      title: "搜查記：警察異能館",
      category: "exhibition",
      venue: "臺南市美術館",
      city: "臺南市",
      startsOn: "2026-06-30",
      endsOn: "2027-01-10",
      showTimes: [],
      ticketUrls: [],
      imageUrl: "https://www.tnam.museum/images/filesys/images/ch/exhibition/2026_PoliceEXPO/0602--edm-1280_960pxS.jpg",
      sourceUrl: "https://www.tnam.museum/exhibition/detail/718",
    });
    expect(valid(events)).toBe(true);
  });

  it("預告：日文版跳過、中文版留下", () => {
    const events = parseTnamPage(fixture("tnam", "upcoming.html"));
    expect(events.map((event) => [event.sourceId, event.title, event.startsOn, event.endsOn])).toEqual([
      ["726", "迴圈．超展開：第一屆臺南藝術雙年展", "2026-10-31", "2027-03-01"],
    ]);
  });

  it("版型不對丟錯", () => {
    expect(() => parseTnamPage("<html>403 Forbidden</html>")).toThrow(/南美館/);
  });
});
