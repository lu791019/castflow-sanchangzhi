import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateCollectedEvent } from "../../../src/lib/events/collected.ts";
import { parseClabEvents } from "./clab.ts";
import { parseKdmofaPage } from "./kdmofa.ts";
import { parseMocaPage } from "./moca.ts";

const FIXTURES = path.join(__dirname, "..", "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");
const valid = (events: unknown[]) => events.every((event) => validateCollectedEvent(event) !== null);

describe("C-LAB", () => {
  const events = parseClabEvents(fixture("clab", "events.html"));

  it("只收展覽與演出：講座、桌遊測試、論壇、沒分類的不收；國外合作展不收", () => {
    expect(events.map((event) => event.sourceId)).toEqual([
      "uniformosa",
      "mother-ing-soup",
      "tokyo-kimono-show2026",
      "2026-ircam-soundoff-event",
      "sync-connectivity",
      "we-are-becoming-forum",
    ]);
  });

  it("展覽欄位；中英標題只留中文；演出照標題推細類", () => {
    expect(events[0]).toEqual({
      source: "clab",
      sourceId: "uniformosa",
      title: "《文化量產系統 UNIFORMOSA》周裕穎跨域制服設計展",
      category: "exhibition",
      venue: "臺灣當代文化實驗場",
      city: "臺北市",
      startsOn: "2026-10-15",
      endsOn: "2026-10-18",
      showTimes: [],
      ticketUrls: [],
      imageUrl: "https://cms.clab.org.tw/app/uploads/2026/10/thumb_2x_image_63d2211014-1.jpeg",
      sourceUrl: "https://clab.org.tw/events/uniformosa",
    });
    expect(events[1]).toMatchObject({ title: "文化前線IV｜母湯", category: "performance", startsOn: "2026-11-06", endsOn: "2026-11-08" });
    expect(valid(events)).toBe(true);
  });

  it("找不到 initialEvents 丟錯", () => {
    expect(() => parseClabEvents("<html><script>self.__next_f.push([1,\"x\"])</script></html>")).toThrow(/C-LAB/);
    expect(() => parseClabEvents("<html>Just a moment...</html>")).toThrow(/C-LAB/);
  });

  it("單日演出沒寫結束日用開始日；展覽沒有結束日不收；字串裡的括號不影響解析", () => {
    const item = (slug: string, type: string, end: string | null) => ({
      title: `演出 [${slug}] {x}`,
      slug,
      eventTypes: { nodes: [{ name: "", slug: type }] },
      singleEvent: { date: { start: "2026-10-20T00:00:00+00:00", end }, location: "C-LAB" },
    });
    const payload = `1f:{"initialEvents":${JSON.stringify([item("show", "performance", null), item("expo", "exhibition", null)])}}`;
    const html = `<script>self.__next_f.push(${JSON.stringify([1, payload])})</script>`;
    expect(parseClabEvents(html).map((event) => [event.sourceId, event.startsOn, event.endsOn])).toEqual([["show", "2026-10-20", "2026-10-20"]]);
  });
});

describe("臺北當代藝術館", () => {
  it("當期 4 檔：起訖、圖（延遲載入的 data-src）、標題當 id", () => {
    const events = parseMocaPage(fixture("moca", "current.html"));
    expect(events.map((event) => [event.title, event.startsOn, event.endsOn])).toEqual([
      ["美術館之後", "2026-09-19", "2026-12-31"],
      ["是誰躲起來了？", "2026-09-25", "2026-11-22"],
      ["當未來不再被紀念", "2026-10-03", "2026-11-22"],
      ["叢靈開始—黃怡嘉個展", "2026-09-12", "2026-11-08"],
    ]);
    expect(events[0]).toMatchObject({
      source: "moca",
      sourceId: "美術館之後",
      category: "exhibition",
      venue: "臺北當代藝術館",
      city: "臺北市",
      imageUrl: "https://www.mocataipei.org.tw/upload/2026_08_253/202608251605134k7o3z6Mi1.jpg",
      sourceUrl: "https://www.mocataipei.org.tw/tw/ExhibitionAndEvent/Info/%E7%BE%8E%E8%A1%93%E9%A4%A8%E4%B9%8B%E5%BE%8C",
    });
    expect(valid(events)).toBe(true);
  });

  it("預告頁沒有展覽回空；版型不對丟錯", () => {
    expect(parseMocaPage(fixture("moca", "upcoming.html"))).toEqual([]);
    expect(() => parseMocaPage("<html></html>")).toThrow(/當代館/);
  });
});

describe("關渡美術館", () => {
  it("當期 5 檔收 4 檔（「工作坊成果展」被共用雜訊規則擋掉）：點分隔日期、圖、活動頁", () => {
    const events = parseKdmofaPage(fixture("kdmofa", "current.html"));
    expect(events.map((event) => event.title)).toEqual(["機制校園生活", "版知道︰自然與人類的備忘史", "安娜史塔希亞 ·薩莫伊洛娃：影像的氣候", "當代主義狗：李兆起個展"]);
    expect(events[0]).toMatchObject({
      source: "kdmofa",
      sourceId: "e1626ae68798853bcff9a390f902a9dfe19c40183113c859013b5dd4f289155c",
      title: "機制校園生活",
      category: "exhibition",
      venue: "關渡美術館",
      city: "臺北市",
      startsOn: "2026-10-16",
      endsOn: "2027-01-10",
      imageUrl: "https://kdmofa.tnua.edu.tw/public/files/exhibition/Idb7506ab9dd304807eT.jpg",
      sourceUrl: "https://kdmofa.tnua.edu.tw/mod/exhibition/index.php?REQUEST_ID=e1626ae68798853bcff9a390f902a9dfe19c40183113c859013b5dd4f289155c",
    });
    expect(valid(events)).toBe(true);
  });

  it("版型不對丟錯", () => {
    expect(() => parseKdmofaPage("<html>404</html>")).toThrow(/關渡/);
  });
});
