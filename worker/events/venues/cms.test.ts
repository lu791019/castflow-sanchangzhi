import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateCollectedEvent } from "../../../src/lib/events/collected.ts";
import { CMS_SITES, cmsToEvent, needsDetail, parseCmsList, parseCultureDetail } from "./cms.ts";

const FIXTURES = path.join(__dirname, "..", "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");

describe("國立 CMS 三館", () => {
  it("史博館：列表有日期與地點；只寫開始日（常設、兒童空間）不收；館外展用館外場地", () => {
    const site = CMS_SITES.nmh;
    const items = parseCmsList(fixture("nmh", "list.html"), "史博館");
    expect(items).toHaveLength(6);
    expect(items[1]).toMatchObject({ id: "60060", title: "隱身到現身──史博典藏的她們", startsOn: "2026-10-16", endsOn: "2027-01-17", location: "國立歷史博物館1樓" });
    const events = items.flatMap((item) => cmsToEvent(site, site.lists[0], item) ?? []);
    expect(events.map((event) => [event.title, event.venue, event.city])).toEqual([
      ["異想物語—館藏動物圖樣的沉浸旅程", "國立歷史博物館", "臺北市"],
      ["隱身到現身──史博典藏的她們", "國立歷史博物館", "臺北市"],
      ["東瀾．共韻—傅益瑤臺日藝術交流展", "國立歷史博物館", "臺北市"],
      ["菩提心起—國立歷史博物館典藏佛像特展", "佛光山佛陀紀念館第二展廳", null],
    ]);
    expect(events[0]).toMatchObject({
      source: "nmh",
      sourceId: "60061",
      category: "exhibition",
      imageUrl: "https://event.culture.tw/mocweb/reg/userFiles/NMH/JpgFile/01/60061/AD/60061_0_0_246574.jpg",
      sourceUrl: "https://event.culture.tw/mocweb/reg/NMH/Detail.init.ctr?actId=60061",
    });
    expect(events.every((event) => validateCollectedEvent(event) !== null)).toBe(true);
  });

  it("中正紀念堂：（免費參觀）拿掉；五年的常設展廳不收；展廳位置用館名", () => {
    const site = CMS_SITES.cksmh;
    const events = parseCmsList(fixture("cksmh", "list.html"), "中正紀念堂").flatMap((item) => cmsToEvent(site, site.lists[0], item) ?? []);
    expect(events.map((event) => event.title)).toEqual([
      "2026年第七屆唐獎榮耀展",
      "女孩日密室逃脫, 解鎖未來的我",
      "樸書．曹淑美作品展",
      "工藝公益．點亮臺灣—第17屆身障者與收容人藝術創作大展",
      "相揪迺夜市－2026罕見疾病基金會文創成果展",
    ]);
    expect(new Set(events.map((event) => event.venue))).toEqual(new Set(["中正紀念堂"]));
  });

  it("臺博館：列表沒日期 → 工作坊、導覽不抓明細，特展才抓", () => {
    const items = parseCmsList(fixture("ntm", "special-5472.html"), "臺博館");
    expect(items.map((item) => [item.title, needsDetail(item)])).toEqual([
      ["骨早味：異特龍記憶與化石繪圖", true],
      ["方寸福田—謝碧蓮女士捐贈吉祥玉飾", true],
      ["島嶼飛行—臺灣蝶蛾生存記", true],
      ["臺灣有犀", true],
      ["臺博數位導覽服務（Web版）-智慧導覽．一掃即行", false],
    ]);
    // 沒補到日期就不收
    const site = CMS_SITES.ntm;
    expect(cmsToEvent(site, site.lists[0], items[0])).toBeNull();
  });

  it("文化部明細頁：場次起訖；補上後臺博館特展收得到", () => {
    const dates = parseCultureDetail(fixture("ntm", "detail-60183.html"));
    expect(dates).toEqual({ startsOn: "2026-07-14", endsOn: "2026-11-01" });
    const site = CMS_SITES.ntm;
    const [item] = parseCmsList(fixture("ntm", "special-5472.html"), "臺博館");
    expect(cmsToEvent(site, site.lists[2], { ...item, ...dates })).toMatchObject({
      source: "ntm",
      sourceId: "60183",
      venue: "國立臺灣博物館南門館",
      city: "臺北市",
      startsOn: "2026-07-14",
      endsOn: "2026-11-01",
    });
  });

  it("多場次取最早～最晚；沒有場次回 null；版型不對丟錯", () => {
    const html = '<div id="blockOriginal">2026/10/01 10:00 ~ 2026/10/01 12:00 … 2026/09/20 10:00 ~ 2026/12/31 17:00</div>';
    expect(parseCultureDetail(html)).toEqual({ startsOn: "2026-09-20", endsOn: "2026-12-31" });
    expect(parseCultureDetail('<div id="blockOriginal"></div>')).toBeNull();
    expect(() => parseCultureDetail("<html>系統忙碌中</html>")).toThrow(/文化部/);
    expect(() => parseCmsList("<html>Forbidden</html>", "史博館")).toThrow(/史博館/);
  });
});
