import { describe, expect, it } from "vitest";
import {
  classifyTitle,
  cityFromAddress,
  eventKindOf,
  eventNormKey,
  isNoiseTitle,
  unionTicketUrls,
  validateCollectedEvent,
  type CollectedEvent,
} from "./collected";

function collected(overrides: Partial<CollectedEvent> = {}): CollectedEvent {
  return {
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
    ticketUrls: [{ source: "opentix", url: "https://www.opentix.life/event/2095065236091641857" }],
    imageUrl: "https://s3.resource.opentix.life/upload/program/x.jpg",
    sourceUrl: "https://www.opentix.life/event/2095065236091641857",
    ...overrides,
  };
}

describe("eventKindOf：細類 → 演出／展覽兩大類", () => {
  it("展覽是展覽，其他都是演出", () => {
    expect(eventKindOf("exhibition")).toBe("exhibition");
    expect((["performance", "concert", "festival", "theatre", "dance"] as const).map((category) => eventKindOf(category))).toEqual(["live", "live", "live", "live", "live"]);
  });
});

describe("classifyTitle：標題推細類", () => {
  it("音樂祭、展覽、舞台劇、舞蹈、音樂會", () => {
    expect(classifyTitle("2026 大港開唱音樂祭", "performance")).toBe("festival");
    expect(classifyTitle("Taipei Jazz Fest", "performance")).toBe("festival");
    expect(classifyTitle("烽火船說－水下文化資產特展", "performance")).toBe("exhibition");
    expect(classifyTitle("2026噪音風暴：《樓上的好人》", "performance")).toBe("performance");
    expect(classifyTitle("盜火劇團《熊出沒的森林》讀劇演出", "performance")).toBe("theatre");
    expect(classifyTitle("音樂劇《釧兒》", "performance")).toBe("theatre");
    expect(classifyTitle("雲門舞集《毛月亮》", "performance")).toBe("dance");
    expect(classifyTitle("舞台劇《小王子》", "performance")).toBe("theatre");
    expect(classifyTitle("2026探索管風琴音樂《管風琴與天籟》", "performance")).toBe("concert");
    expect(classifyTitle("五月天演唱會", "performance")).toBe("concert");
    expect(classifyTitle("Fujii Kaze Prema World Tour - Kaohsiung", "performance")).toBe("concert");
    expect(classifyTitle("青虫aoi 2026 冬季小巡迴《Before Sunrise》", "performance")).toBe("concert");
    // 喜劇巡迴不是音樂會
    expect(classifyTitle("涵冷娜脫口秀專場《喊卡之後》 封箱巡迴", "performance")).toBe("performance");
  });

  it("影展、電影節、短片放映不收（電影交給 TMDB）", () => {
    expect(classifyTitle("雄影國際短片競賽：臺灣組 B｜高雄電影節", "performance")).toBeNull();
    expect(classifyTitle("金馬影展 開幕片", "performance")).toBeNull();
  });

  it("攝影展、光影展是展覽、不是影展", () => {
    expect(classifyTitle("松菸夜光花園 光影展", "exhibition")).toBe("exhibition");
    expect(classifyTitle("微光寄旅-第九屆科學攝影展", "exhibition")).toBe("exhibition");
    expect(classifyTitle("海洋生態攝影巡迴展", "performance")).toBe("exhibition");
  });

  it("「展演」「發展」不算展覽；看不出來就用來源給的類別", () => {
    expect(classifyTitle("城市展演空間年度發表", "performance")).toBe("performance");
    expect(classifyTitle("永續發展論壇之夜", "exhibition")).toBe("exhibition");
  });
});

describe("isNoiseTitle：課程、講座、品酒等不是藝文活動", () => {
  it("擋掉", () => {
    for (const title of [
      "身體日常肢體開發｜長期課",
      "聲音設備操作與音控實務：入門班①",
      "爵士與藍調：音樂診療室一對一諮詢示範",
      "台北松山｜45坪商務活動空間與場地租借",
      "Douxteel Wine－午後爵士紅酒微醺",
      "星座頌缽靜心｜天秤專場",
      "TAG Story 創辦人故事課",
      "驗證der",
      "烏克麗麗彈唱班",
      "下班放鬆一下｜音缽放鬆",
      "第八講｜《羅恩格林》異數講堂",
      "「唱咱的歌.行咱的路」：吳晉淮台語音樂文化導覽培力",
      "台北電器空調影音大展 預約逛展抽家電",
      "第二屆 TCE 台灣卡牌展覽會",
      "留白之聲黑膠分享會",
    ]) {
      expect(isNoiseTitle(title), title).toBe(true);
    }
  });

  it("一般演出不擋", () => {
    for (const title of ["2026 江仰小專場 ● 睡毋落覺 ● 台南場", "2026 HJO Jam Session 10月份", "鬱卒的平面：李亦凡", "下班後的爵士夜", "班傑明的奇幻旅程音樂會"]) {
      expect(isNoiseTitle(title), title).toBe(false);
    }
  });
});

describe("cityFromAddress：地址或英文城市 → 縣市（台寫成臺）", () => {
  it("中文地址取第一個縣市", () => {
    expect(cityFromAddress("台北市大安區光復南路102號1樓")).toBe("臺北市");
    expect(cityFromAddress("台灣台南市臺南市中西區兌悅里信義街110號")).toBe("臺南市");
    expect(cityFromAddress("新竹市東區光復路一段313號B1")).toBe("新竹市");
    expect(cityFromAddress("新竹縣竹北市縣政九路146號")).toBe("新竹縣");
    expect(cityFromAddress("北市中山區復興北路480號")).toBe("臺北市");
  });

  it("英文城市（Accupass 列表）", () => {
    expect(cityFromAddress("Taipei City")).toBe("臺北市");
    expect(cityFromAddress("New Taipei City")).toBe("新北市");
    expect(cityFromAddress("Kaohsiung City")).toBe("高雄市");
  });

  it("沒有縣市回 null", () => {
    expect(cityFromAddress("")).toBeNull();
    expect(cityFromAddress("依各場次")).toBeNull();
    expect(cityFromAddress(null)).toBeNull();
  });
});

describe("eventNormKey：標題正規化＋起始日＋場地正規化", () => {
  it("全形、標點、空白、台／臺、場地前的縣市不影響", () => {
    const a = eventNormKey({ title: "島嶼夜歌・草地音樂會", startsOn: "2026-10-20", venue: "臺北市 大安森林公園" });
    const b = eventNormKey({ title: "「島嶼夜歌」草地音樂會！", startsOn: "2026-10-20", venue: "台北市大安森林公園" });
    expect(a).toBe(b);
    expect(a).toBe("島嶼夜歌草地音樂會|2026-10-20|大安森林公園");
  });

  it("市立場館不拆字", () => {
    expect(eventNormKey({ title: "坂本龍一", startsOn: "2026-10-31", venue: "臺北市立美術館" })).toBe("坂本龍一|2026-10-31|臺北市立美術館");
  });

  it("起始日或場地不同就不同", () => {
    const base = { title: "島嶼夜歌", startsOn: "2026-10-20", venue: "國家音樂廳" };
    expect(eventNormKey(base)).not.toBe(eventNormKey({ ...base, startsOn: "2026-10-21" }));
    expect(eventNormKey(base)).not.toBe(eventNormKey({ ...base, venue: "衛武營" }));
  });

  it("沒場地也能算；最長 300 字", () => {
    expect(eventNormKey({ title: "島嶼夜歌", startsOn: "2026-10-20", venue: null })).toBe("島嶼夜歌|2026-10-20|");
    expect(Array.from(eventNormKey({ title: "長".repeat(400), startsOn: "2026-10-20", venue: "館".repeat(400) })).length).toBeLessThanOrEqual(300);
  });
});

describe("validateCollectedEvent：ingest 邊界驗證", () => {
  it("合法的原樣回傳（字串修剪）", () => {
    const parsed = validateCollectedEvent({ ...collected(), title: "  盜火劇團《熊出沒的森林》讀劇演出 " });
    expect(parsed).toEqual(collected());
  });

  it("壞資料回 null：來源、類別、日期、網址", () => {
    expect(validateCollectedEvent(null)).toBeNull();
    expect(validateCollectedEvent({ ...collected(), source: "tixcraft" })).toBeNull();
    expect(validateCollectedEvent({ ...collected(), category: "movie" })).toBeNull();
    expect(validateCollectedEvent({ ...collected(), startsOn: "2026-02-30" })).toBeNull();
    expect(validateCollectedEvent({ ...collected(), endsOn: "2026-10-01" })).toBeNull();
    expect(validateCollectedEvent({ ...collected(), sourceUrl: "http://example.com" })).toBeNull();
    expect(validateCollectedEvent({ ...collected(), title: "" })).toBeNull();
    expect(validateCollectedEvent({ ...collected(), title: "長".repeat(201) })).toBeNull();
  });

  it("可選欄位壞掉就清掉，不整筆丟", () => {
    const parsed = validateCollectedEvent({
      ...collected(),
      imageUrl: "javascript:alert(1)",
      venue: "",
      city: "火星",
      showTimes: [{ date: "2026-10-16", time: "25:00" }, { date: "nope" }, "x"],
      ticketUrls: [{ source: "kktix", url: "ftp://x" }, { source: "opentix", url: "https://www.opentix.life/event/1" }],
    });
    expect(parsed).toMatchObject({
      imageUrl: null,
      venue: null,
      city: null,
      showTimes: [{ date: "2026-10-16", time: null }],
      ticketUrls: [{ source: "opentix", url: "https://www.opentix.life/event/1" }],
    });
  });
});

describe("unionTicketUrls：多來源售票連結聯集", () => {
  it("同網址只留一次，保留先後順序", () => {
    expect(
      unionTicketUrls([
        [{ source: "kktix", url: "https://a.kktix.cc/events/1" }],
        [
          { source: "opentix", url: "https://www.opentix.life/event/2" },
          { source: "kktix", url: "https://a.kktix.cc/events/1" },
        ],
      ]),
    ).toEqual([
      { source: "kktix", url: "https://a.kktix.cc/events/1" },
      { source: "opentix", url: "https://www.opentix.life/event/2" },
    ]);
  });
});
