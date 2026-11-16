import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateCollectedEvent } from "../../src/lib/events/collected.ts";
import { accupassToEvent, parseAccupassEvent, parseAccupassSearch, plausibleVenue } from "./accupass.ts";
import { cleanText, slashDateTime, taipeiDateTime } from "./html.ts";
import { kktixFeedUrl, kktixToEvent, parseKktixFeed, parseKktixImage } from "./kktix.ts";
import { parseOpentixEvent, parseOpentixSitemap } from "./opentix.ts";
import { parseTfamExhibitions } from "./tfam.ts";

const FIXTURES = path.join(__dirname, "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");

describe("html 小工具", () => {
  it("cleanText 去隱形字元與 entity", () => {
    expect(cleanText("鳴石樂集 ​​《她，留下了歌》&amp;nbsp; ")).toBe("鳴石樂集 《她，留下了歌》&nbsp;");
    expect(cleanText("光復南路102⁠號1⁠樓")).toBe("光復南路102號1樓");
  });

  it("taipeiDateTime：有時區換算、沒時區當台北時間、00:00 算沒寫", () => {
    expect(taipeiDateTime("2026-10-24T12:00:00Z")).toEqual({ date: "2026-10-24", time: "20:00" });
    expect(taipeiDateTime("2026-10-31T19:30:00.000+08:00")).toEqual({ date: "2026-10-31", time: "19:30" });
    expect(taipeiDateTime("2026-10-16T19:30:00")).toEqual({ date: "2026-10-16", time: "19:30" });
    expect(taipeiDateTime("2026-10-16T00:00:00")).toEqual({ date: "2026-10-16", time: null });
    expect(taipeiDateTime("2026-02-30T10:00:00")).toBeNull();
    expect(taipeiDateTime(undefined)).toBeNull();
  });

  it("slashDateTime", () => {
    expect(slashDateTime("2026/10/09 19:30(+0800)")).toEqual({ date: "2026-10-09", time: "19:30" });
    expect(slashDateTime("2026/9/12")).toEqual({ date: "2026-09-12", time: null });
    expect(slashDateTime("依各場次")).toBeNull();
  });
});

describe("KKTIX Atom", () => {
  const entries = parseKktixFeed(fixture("kktix", "performance.atom"));

  it("網址：第 1 頁不帶 page", () => {
    expect(kktixFeedUrl(4, 1)).toBe("https://kktix.com/events.atom?category_id=4");
    expect(kktixFeedUrl(4, 3)).toBe("https://kktix.com/events.atom?category_id=4&page=3");
  });

  it("每筆都解析出編號、網址、期間、場地與地址", () => {
    expect(entries).toHaveLength(6);
    expect(entries[2]).toEqual({
      id: "CollectionEvent-124617",
      url: "https://reitianwenhuayishu.kktix.cc/events/dabeb856",
      title: "2026噪音風暴：《樓上的好人》",
      startsOn: "2026-10-09",
      endsOn: "2026-10-25",
      time: "19:30",
      venue: "水源劇場",
      address: "臺北市中正區水源里羅斯福路四段92號10樓",
    });
    expect(entries[0].id).toBe("Event-126170");
    // 「依各場次」不是場地
    expect(entries[1].venue).toBeNull();
  });

  it("轉成活動：城市從地址取、售票連到活動頁、圖片另給", () => {
    const event = kktixToEvent(entries[2], "performance", "https://assets.kktix.io/upload_images/562779/x.jpg");
    expect(event).toMatchObject({
      source: "kktix",
      sourceId: "CollectionEvent-124617",
      category: "performance",
      venue: "水源劇場",
      city: "臺北市",
      startsOn: "2026-10-09",
      endsOn: "2026-10-25",
      showTimes: [{ date: "2026-10-09", time: "19:30" }],
      ticketUrls: [{ source: "kktix", url: "https://reitianwenhuayishu.kktix.cc/events/dabeb856" }],
      imageUrl: "https://assets.kktix.io/upload_images/562779/x.jpg",
    });
    expect(validateCollectedEvent(event)).toEqual(event);
  });

  it("展覽 feed：類別展覽；場地裡帶縣市也認得", () => {
    const exhibitions = parseKktixFeed(fixture("kktix", "exhibition.atom")).map((entry) => kktixToEvent(entry, "exhibition", null));
    expect(exhibitions[0]).toMatchObject({ category: "exhibition", city: "苗栗縣" });
    expect(exhibitions[1]).toMatchObject({ title: "【日本爆紅展覽首度來台】「恐怖心展・台北」", city: "臺北市" });
  });

  it("活動頁取 og:image", () => {
    expect(parseKktixImage(fixture("kktix", "event-dabeb856.html"))).toBe(
      "https://assets.kktix.io/upload_images/562779/0715_%E6%A8%93%E4%B8%8A%E7%9A%84%E5%A5%BD%E4%BA%BA1200_630_original.jpg",
    );
  });

  it("不是 feed 丟錯；空 feed 回空", () => {
    expect(() => parseKktixFeed("<html>Just a moment...</html>")).toThrow(/KKTIX/);
    expect(parseKktixFeed('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>')).toEqual([]);
  });
});

describe("OPENTIX", () => {
  it("sitemap 只留 /event/<id>", () => {
    const links = parseOpentixSitemap(fixture("opentix", "sitemap.xml"));
    expect(links.length).toBeGreaterThanOrEqual(5);
    expect(links.every((link) => /^https:\/\/www\.opentix\.life\/event\/\d+$/.test(link.url))).toBe(true);
    expect(() => parseOpentixSitemap("<html></html>")).toThrow(/OPENTIX/);
  });

  it("讀劇：兩場次、場館、城市、圖、購票網址", () => {
    const link = { id: "2095065236091641857", url: "https://www.opentix.life/event/2095065236091641857" };
    const event = parseOpentixEvent(fixture("opentix", "event-2095065236091641857.html"), link);
    expect(event).toMatchObject({
      source: "opentix",
      sourceId: "2095065236091641857",
      title: "盜火劇團《熊出沒的森林》讀劇演出",
      category: "theatre",
      venue: "新竹縣政府文化局演奏廳",
      city: "新竹縣",
      startsOn: "2026-10-16",
      endsOn: "2026-10-17",
      showTimes: [
        { date: "2026-10-16", time: "19:30" },
        { date: "2026-10-17", time: "14:30" },
      ],
      ticketUrls: [{ source: "opentix", url: link.url }],
    });
    expect(event?.imageUrl).toMatch(/^https:\/\/s3\.resource\.opentix\.life\//);
  });

  it("管風琴音樂會：音樂會、高雄", () => {
    const link = { id: "2063941379521384448", url: "https://www.opentix.life/event/2063941379521384448" };
    expect(parseOpentixEvent(fixture("opentix", "event-2063941379521384448.html"), link)).toMatchObject({
      category: "concert",
      venue: "衛武營國家藝術文化中心音樂廳",
      city: "高雄市",
      startsOn: "2026-11-25",
      showTimes: [{ date: "2026-11-25", time: "14:30" }],
    });
  });

  it("長期展：故事展算展覽、展期到 2030", () => {
    const link = { id: "1997861121855938561", url: "https://www.opentix.life/event/1997861121855938561" };
    expect(parseOpentixEvent(fixture("opentix", "event-1997861121855938561.html"), link)).toMatchObject({
      category: "exhibition",
      city: "臺北市",
      startsOn: "2026-01-01",
      endsOn: "2030-12-31",
    });
  });

  it("影展場次不收；沒有 JSON-LD 回 null", () => {
    const link = { id: "2095816296718020609", url: "https://www.opentix.life/event/2095816296718020609" };
    expect(parseOpentixEvent(fixture("opentix", "event-2095816296718020609.html"), link)).toBeNull();
    expect(parseOpentixEvent("<html></html>", link)).toBeNull();
  });
});

describe("Accupass", () => {
  it("搜尋頁 RSC → 實體活動清單", () => {
    const items = parseAccupassSearch(fixture("accupass", "search-music.html"));
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0]).toMatchObject({
      id: "2609160806171007001595",
      startDateTime: "2027-05-08T11:30:00Z",
      location: "Taipei City",
    });
    expect(() => parseAccupassSearch("<html></html>")).toThrow(/Accupass/);
  });

  it("活動頁 JSON-LD：地址去掉「台灣」、大圖", () => {
    expect(parseAccupassEvent(fixture("accupass", "event-2609231200206771718320.html"))).toMatchObject({
      address: "台南市臺南市中西區兌悅里信義街110號",
      locationName: "附近不好停車，記得早點來找停車位",
      imageUrl: expect.stringMatching(/^https:\/\/static\.accupass\.com\/eventbanner\//),
    });
  });

  it("主辦亂填的場地名不用", () => {
    expect(plausibleVenue("附近不好停車，記得早點來找停車位")).toBeNull();
    expect(plausibleVenue("鳴石音樂空間")).toBe("鳴石音樂空間");
    expect(plausibleVenue("石牌捷運站、樂家康超市(北投致遠店)斜對面、7-11對面")).toBeNull();
    expect(plausibleVenue("近捷運大坪林站3號口")).toBeNull();
    expect(plausibleVenue("微光孔雀閣 （行天宮捷運站1號出口）")).toBe("微光孔雀閣");
  });

  it("轉成活動：台北時間、城市從地址取", () => {
    const detail = parseAccupassEvent(fixture("accupass", "event-2609231200206771718320.html"));
    const event = accupassToEvent(
      { id: "2609231200206771718320", name: "2026 江仰小專場 ● 睡毋落覺 ● 台南場 @蘿拉冷飲店", photoUrl: null, startDateTime: "2026-10-24T11:30:00Z", endDateTime: "2026-10-24T12:30:00Z", location: "Tainan City" },
      detail,
    );
    expect(event).toMatchObject({
      source: "accupass",
      venue: null,
      city: "臺南市",
      startsOn: "2026-10-24",
      showTimes: [{ date: "2026-10-24", time: "19:30" }],
      ticketUrls: [{ source: "accupass", url: "https://www.accupass.com/event/2609231200206771718320" }],
    });
  });

  it("沒有活動頁也能用列表資料（英文城市）", () => {
    const event = accupassToEvent(
      { id: "2609160806171007001595", name: "鳴石樂集音樂殿堂 《她，留下了歌》系列音樂會", photoUrl: "https://static.accupass.com/eventbanner/a.jpg", startDateTime: "2027-05-08T11:30:00Z", endDateTime: "2027-12-11T13:00:00Z", location: "Taipei City" },
      null,
    );
    expect(event).toMatchObject({ category: "concert", city: "臺北市", startsOn: "2027-05-08", endsOn: "2027-12-11", imageUrl: "https://static.accupass.com/eventbanner/a.jpg" });
  });

  it("課程類標題不收", () => {
    expect(
      accupassToEvent({ id: "2609081447234510451260", name: "身體日常肢體開發｜長期課", photoUrl: null, startDateTime: "2026-10-23T11:30:00Z", endDateTime: "2026-11-13T13:00:00Z", location: "Taipei City" }, null),
    ).toBeNull();
  });
});

describe("北美館", () => {
  it("現正展出：館內展覽、海外展不收、圖與活動頁", () => {
    const events = parseTfamExhibitions(JSON.parse(fixture("tfam", "current.json")));
    expect(events.map((event) => event.sourceId)).toEqual(["813", "814", "816", "800"]);
    expect(events[0]).toMatchObject({
      source: "tfam",
      title: "王雅慧：旅行者",
      category: "exhibition",
      venue: "臺北市立美術館",
      city: "臺北市",
      startsOn: "2026-09-12",
      endsOn: "2027-01-03",
      ticketUrls: [],
      imageUrl: "https://www.tfam.museum/File/Exhibition/Main/813/2026081415005955910013.jpg",
      sourceUrl: "https://www.tfam.museum/Exhibition/Exhibition_Special.aspx?ddlLang=zh-tw&id=813",
    });
  });

  it("即將展出", () => {
    const events = parseTfamExhibitions(JSON.parse(fixture("tfam", "upcoming.json")));
    expect(events.map((event) => [event.title, event.startsOn])).toEqual([
      ["坂本龍一︱觀音．聽時", "2026-10-31"],
      ["2026臺北美術獎", "2026-10-24"],
    ]);
  });

  it("Status 不是 1 丟錯", () => {
    expect(() => parseTfamExhibitions({ Status: "0", StatusMessage: "x" })).toThrow(/北美館/);
  });
});
