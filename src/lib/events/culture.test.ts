import { describe, expect, it } from "vitest";
import {
  CULTURE_LIMITS,
  cultureKindOf,
  isFestivalTitle,
  parseCultureEvents,
  selectCultureEvents,
  type CultureEvent,
} from "./culture";

const TODAY = "2026-10-14";

function raw(overrides: Record<string, unknown> = {}) {
  return {
    UID: "u1",
    title: "島嶼夜歌",
    category: "1",
    showInfo: [
      {
        time: "2026/10/20 19:30:00",
        location: "台北市中正區中山南路21-1號",
        locationName: "國家音樂廳",
        onSales: "Y",
        price: "500",
        latitude: null,
        longitude: null,
        endTime: "2026/10/20 21:30:00",
      },
    ],
    startDate: "2026/10/20",
    endDate: "2026/10/20",
    imageUrl: "",
    webSales: "https://www.opentix.life/event/1",
    sourceWebPromote: "",
    ...overrides,
  };
}

function event(overrides: Partial<CultureEvent> = {}): CultureEvent {
  return {
    uid: "e1",
    kind: "live",
    festival: false,
    title: "演出",
    imageUrl: null,
    link: null,
    sessions: [{ start: "2026-10-20", end: null, time: "19:30", venue: "國家音樂廳" }],
    ...overrides,
  };
}

describe("cultureKindOf：文化部類別 → 演出／展覽", () => {
  it("音樂、戲劇、舞蹈、獨立音樂、演唱會是演出；展覽是展覽；其他不收", () => {
    expect(["1", "2", "3", "5", "17"].map(cultureKindOf)).toEqual(["live", "live", "live", "live", "live"]);
    expect(cultureKindOf("6")).toBe("exhibition");
    expect(cultureKindOf("4")).toBeNull();
    expect(cultureKindOf("")).toBeNull();
  });
});

describe("isFestivalTitle", () => {
  it("音樂祭／音樂節／Fest（不分大小寫）", () => {
    expect(isFestivalTitle("2026 大港開唱音樂祭")).toBe(true);
    expect(isFestivalTitle("台中爵士音樂節")).toBe(true);
    expect(isFestivalTitle("Megaport FESTIVAL")).toBe(true);
    expect(isFestivalTitle("Jason Mraz ASIA TOUR")).toBe(false);
  });
});

describe("parseCultureEvents", () => {
  it("欄位對應：日期換 YYYY-MM-DD、時間取 HH:MM、場地用 locationName、網址優先 webSales", () => {
    const [parsed] = parseCultureEvents([raw()], "1");
    expect(parsed).toEqual({
      uid: "u1",
      kind: "live",
      festival: false,
      category: "performance",
      title: "島嶼夜歌",
      imageUrl: null,
      link: { url: "https://www.opentix.life/event/1", ticket: true },
      sessions: [{ start: "2026-10-20", end: null, time: "19:30", venue: "國家音樂廳", city: "臺北市" }],
    });
  });

  it("縣市：地址推（台 → 臺），地址看不出來再看場地名，都看不出來 null", () => {
    const shows = [
      { time: "2026/10/20 19:30:00", endTime: "", location: "高雄市鹽埕區大勇路1號", locationName: "駁二" },
      { time: "2026/10/21 19:30:00", endTime: "", location: "", locationName: "台南市立美術館" },
      { time: "2026/10/22 19:30:00", endTime: "", location: "", locationName: "國家音樂廳" },
    ];
    const [parsed] = parseCultureEvents([raw({ showInfo: shows })], "1");
    expect(parsed.sessions.map((session) => session.city)).toEqual(["高雄市", "臺南市", null]);
  });

  it("細類：類別代碼、標題推（文化部只分演出／展覽／音樂祭，用同一套 titleCategory）", () => {
    expect(parseCultureEvents([raw({ title: "夜行" })], "2")[0].category).toBe("theatre");
    expect(parseCultureEvents([raw({ title: "島嶼夜歌室內樂" })], "1")[0].category).toBe("concert");
    expect(parseCultureEvents([raw({ title: "浮現祭 Emerge Fest" })], "5")[0].category).toBe("festival");
    expect(parseCultureEvents([raw()], "6")[0].category).toBe("exhibition");
  });

  it("場地去掉來源尾巴的「=」", () => {
    const [parsed] = parseCultureEvents([raw({ showInfo: [{ time: "2026/10/20 19:30:00", endTime: "", locationName: "花蓮市（花蓮縣）=", location: "" }] })], "1");
    expect(parsed.sessions[0].venue).toBe("花蓮市（花蓮縣）");
  });

  it("00:00 當作沒有時間；跨日場次帶結束日；沒有 locationName 用 location", () => {
    const [parsed] = parseCultureEvents(
      [raw({ showInfo: [{ time: "2026/10/24 00:00:00", endTime: "2026/10/26 23:00:00", locationName: "", location: "高雄駁二" }] })],
      "17",
    );
    expect(parsed.sessions).toEqual([{ start: "2026-10-24", end: "2026-10-26", time: null, venue: "高雄駁二", city: null }]);
  });

  it("沒有場次就用 startDate／endDate；圖片 http 升成 https；網址只收 http(s)，退回 sourceWebPromote", () => {
    const [parsed] = parseCultureEvents(
      [
        raw({
          showInfo: [],
          startDate: "2026/09/01",
          endDate: "2026/12/31",
          imageUrl: "http://cloud.culture.tw/img/1.jpg",
          webSales: "javascript:alert(1)",
          sourceWebPromote: "https://www.museum.example/expo",
        }),
      ],
      "6",
    );
    expect(parsed.kind).toBe("exhibition");
    expect(parsed.sessions).toEqual([{ start: "2026-09-01", end: "2026-12-31", time: null, venue: null, city: null }]);
    expect(parsed.imageUrl).toBe("https://cloud.culture.tw/img/1.jpg");
    expect(parsed.link).toEqual({ url: "https://www.museum.example/expo", ticket: false });
  });

  it("壞資料跳過：不是陣列、沒有 UID、沒有標題、標題太長、日期看不懂、加購票券", () => {
    expect(parseCultureEvents({ not: "array" }, "1")).toEqual([]);
    expect(parseCultureEvents(null, "1")).toEqual([]);
    const rows = [
      raw({ UID: "" }),
      raw({ title: "  " }),
      raw({ title: "長".repeat(101) }),
      raw({ showInfo: [], startDate: "不知道", endDate: "" }),
      raw({ title: "Novelbright 限量VIP Upgrade 升級加購" }),
      "not an object",
    ];
    expect(parseCultureEvents(rows, "1")).toEqual([]);
  });

  it("不認得的類別整批不收；音樂祭標題標成音樂祭", () => {
    expect(parseCultureEvents([raw()], "4")).toEqual([]);
    expect(parseCultureEvents([raw({ title: "浮現祭 Emerge Fest" })], "5")[0].festival).toBe(true);
  });
});

describe("selectCultureEvents：今天起 30 天、去重、上限、排序", () => {
  it("演出只留 30 天內有場次的，挑第一個還沒結束的場次", () => {
    const past = event({ uid: "past", sessions: [{ start: "2026-10-01", end: null, time: "19:30", venue: "A" }] });
    const far = event({ uid: "far", sessions: [{ start: "2026-11-20", end: null, time: "19:30", venue: "A" }] });
    const multi = event({
      uid: "multi",
      sessions: [
        { start: "2026-10-10", end: null, time: "19:30", venue: "舊場" },
        { start: "2026-10-30", end: null, time: "14:30", venue: "新場" },
        { start: "2026-12-30", end: null, time: "14:30", venue: "更後面" },
      ],
    });
    const { live } = selectCultureEvents([past, far, multi], TODAY);
    expect(live.map((item) => item.uid)).toEqual(["multi"]);
    expect(live[0].session).toEqual({ start: "2026-10-30", end: null, time: "14:30", venue: "新場" });
  });

  it("演出單一場次跨一個月以上（常態節目）不收；展覽不受限", () => {
    const street = event({ uid: "street", title: "街頭藝人表演", sessions: [{ start: "2026-01-01", end: "2026-12-31", time: null, venue: "A" }] });
    const run = event({ uid: "run", title: "駐演", sessions: [{ start: "2026-10-01", end: "2026-11-01", time: null, venue: "A" }] });
    const expo = event({ uid: "expo", kind: "exhibition", title: "常設展", sessions: [{ start: "2024-01-01", end: "2030-12-31", time: null, venue: "B" }] });
    const picked = selectCultureEvents([street, run, expo], TODAY);
    expect(picked.live.map((item) => item.uid)).toEqual(["run"]);
    expect(picked.exhibition.map((item) => item.uid)).toEqual(["expo"]);
  });

  it("窗尾當天（今天＋30）也算；進行中的多日場次也算", () => {
    const edge = event({ uid: "edge", sessions: [{ start: "2026-11-13", end: null, time: null, venue: "A" }] });
    const ongoing = event({ uid: "on", sessions: [{ start: "2026-10-12", end: "2026-10-15", time: null, venue: "A" }] });
    expect(selectCultureEvents([edge, ongoing], TODAY).live.map((item) => item.uid)).toEqual(["on", "edge"]);
  });

  it("展覽跨期很長照收；還沒開展的排在進行中之後；進行中先結束的在前", () => {
    const long = event({ uid: "long", kind: "exhibition", sessions: [{ start: "2024-01-19", end: "2034-12-31", time: null, venue: "科博館" }] });
    const soon = event({ uid: "soon", kind: "exhibition", sessions: [{ start: "2026-09-01", end: "2026-11-16", time: null, venue: "B" }] });
    const later = event({ uid: "later", kind: "exhibition", sessions: [{ start: "2026-10-30", end: "2027-01-31", time: null, venue: "C" }] });
    const ended = event({ uid: "ended", kind: "exhibition", sessions: [{ start: "2026-01-01", end: "2026-10-13", time: null, venue: "D" }] });
    const notYet = event({ uid: "notyet", kind: "exhibition", sessions: [{ start: "2026-12-01", end: "2027-03-01", time: null, venue: "E" }] });
    const { exhibition } = selectCultureEvents([long, later, soon, ended, notYet], TODAY);
    expect(exhibition.map((item) => item.uid)).toEqual(["soon", "long", "later"]);
  });

  it("近的場次在前，同一天看時間", () => {
    const a = event({ uid: "a", sessions: [{ start: "2026-10-20", end: null, time: "19:30", venue: "A" }] });
    const b = event({ uid: "b", title: "乙", sessions: [{ start: "2026-10-16", end: null, time: "20:00", venue: "B" }] });
    const c = event({ uid: "c", title: "丙", sessions: [{ start: "2026-10-16", end: null, time: "14:00", venue: "C" }] });
    expect(selectCultureEvents([a, b, c], TODAY).live.map((item) => item.uid)).toEqual(["c", "b", "a"]);
  });

  it("同 UID 去重（跨類別重複出現）；同名同日不同 UID 也只留一張", () => {
    const first = event({ uid: "dup", title: "島嶼夜歌" });
    const again = event({ uid: "dup", title: "島嶼夜歌（重複）" });
    const twin = event({ uid: "twin", title: "「島嶼夜歌」" });
    const { live } = selectCultureEvents([first, again, twin], TODAY);
    expect(live.map((item) => item.uid)).toEqual(["dup"]);
  });

  it("每類上限：演出 12、展覽 8", () => {
    expect(CULTURE_LIMITS).toEqual({ live: 12, exhibition: 8 });
    const many = Array.from({ length: 20 }, (_, index) =>
      event({ uid: `l${index}`, title: `演出${index}`, sessions: [{ start: `2026-10-${String(15 + (index % 10)).padStart(2, "0")}`, end: null, time: null, venue: "A" }] }),
    );
    const shows = Array.from({ length: 12 }, (_, index) =>
      event({ uid: `x${index}`, title: `展${index}`, kind: "exhibition", sessions: [{ start: "2026-10-01", end: "2026-12-31", time: null, venue: "B" }] }),
    );
    const picked = selectCultureEvents([...many, ...shows], TODAY);
    expect(picked.live).toHaveLength(12);
    expect(picked.exhibition).toHaveLength(8);
  });
});
