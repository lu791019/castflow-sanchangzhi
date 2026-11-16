import { describe, expect, it } from "vitest";
import { validateCollectedEvent } from "../../../src/lib/events/collected.ts";
import { absoluteUrl, anyDate, dateRange, MAX_EXHIBITION_SPAN_DAYS, rocDate, startedTooLongAgo, venueEvent, venueOf, venueTitle, westernDate } from "./common.ts";

const draft = {
  source: "nmns" as const,
  sourceId: "1",
  title: "微光寄旅-第九屆科學攝影展",
  venue: "國立自然科學博物館",
  city: "臺中市",
  startsOn: "2026-06-18",
  endsOn: "2027-03-28",
  imageUrl: "https://www.nmns.edu.tw/a.jpg",
  sourceUrl: "https://www.nmns.edu.tw/ch/exhibitions/special-exhibitions/Exhibition-000609/",
};

describe("館方來源共用", () => {
  it("西元日期：斜線、橫線、點、ISO 都認得；不是真實日期回 null", () => {
    expect(westernDate("2026/11/06")).toBe("2026-11-06");
    expect(westernDate("2023-12-15")).toBe("2023-12-15");
    expect(westernDate("2026.10.16")).toBe("2026-10-16");
    expect(westernDate("2026-10-15T00:00:00+00:00")).toBe("2026-10-15");
    expect(westernDate("2026/02/30")).toBeNull();
    expect(westernDate(undefined)).toBeNull();
  });

  it("民國日期：七碼、橫線；西元民國混用都解析；空白回 null", () => {
    expect(rocDate("1150618")).toBe("2026-06-18");
    expect(rocDate("115-06-30")).toBe("2026-06-30");
    expect(rocDate("99-1-5")).toBe("2010-01-05");
    expect(anyDate("1160301")).toBe("2027-03-01");
    expect(anyDate("2023-12-15")).toBe("2023-12-15");
    expect(anyDate("")).toBeNull();
    expect(anyDate("1151340")).toBeNull();
  });

  it("起訖區間：~、～；「不定期結束」或只寫一天沒有訖", () => {
    expect(dateRange("113-09-05 ~ 116-08-31", rocDate)).toEqual({ start: "2024-09-05", end: "2027-08-31" });
    expect(dateRange("2026.10.16～2027.01.10", westernDate)).toEqual({ start: "2026-10-16", end: "2027-01-10" });
    expect(dateRange("107-01-01 ~ 不定期結束", rocDate)).toEqual({ start: "2018-01-01", end: null });
    expect(dateRange("日期：2024-02-21", westernDate)).toEqual({ start: "2024-02-21", end: null });
    expect(dateRange("常設展", rocDate)).toEqual({ start: null, end: null });
  });

  it("標題清理：預告標籤、免費參觀、中英並列", () => {
    expect(venueTitle("【展覽預告】隱身到現身──史博典藏的她們")).toBe("隱身到現身──史博典藏的她們");
    expect(venueTitle("樸書．曹淑美作品展(免費參觀)")).toBe("樸書．曹淑美作品展");
    expect(venueTitle("特展 骨早味：異特龍記憶與化石繪圖")).toBe("骨早味：異特龍記憶與化石繪圖");
    expect(venueTitle("特展")).toBe("特展");
    expect(venueTitle("搜查記：警察異能館 Investigation Chronicles: The Police Expo")).toBe("搜查記：警察異能館");
    expect(venueTitle("迴圈．超展開：第一屆臺南藝術雙年展  ╱  Unfolding Loops: 2026 Tainan Art Biennale")).toBe(
      "迴圈．超展開：第一屆臺南藝術雙年展",
    );
    expect(venueTitle("粹 · 本質 | 2026 年 iF 設計獎獲獎作品展 (V)")).toBe("粹 · 本質 | 2026 年 iF 設計獎獲獎作品展 (V)");
    expect(venueTitle("《消失的法老》古夫金字塔 VR 沉浸體驗")).toBe("《消失的法老》古夫金字塔 VR 沉浸體驗");
    expect(venueTitle("TouchDesigner Taiwan 2026")).toBe("TouchDesigner Taiwan 2026");
  });

  it("相對網址轉絕對、中文編碼、同站 http 升 https、外站 http 不收", () => {
    expect(absoluteUrl("FileHandler.ashx?oid=a&amp;fid=b", "https://www.nstm.gov.tw/")).toBe("https://www.nstm.gov.tw/FileHandler.ashx?oid=a&fid=b");
    expect(absoluteUrl("/tw/ExhibitionAndEvent/Info/美術館之後", "https://www.mocataipei.org.tw/")).toBe(
      "https://www.mocataipei.org.tw/tw/ExhibitionAndEvent/Info/%E7%BE%8E%E8%A1%93%E9%A4%A8%E4%B9%8B%E5%BE%8C",
    );
    expect(absoluteUrl("http://www.nmns.edu.tw/a.jpg", "https://www.nmns.edu.tw/")).toBe("https://www.nmns.edu.tw/a.jpg");
    expect(absoluteUrl("http://other.example.com/a.jpg", "https://www.nmns.edu.tw/")).toBeNull();
    expect(absoluteUrl("", "https://www.nmns.edu.tw/")).toBeNull();
  });

  it("館內位置用館名；別的館用位置當場地", () => {
    const home = { name: "國立歷史博物館", pattern: /歷史博物館|史博/ };
    expect(venueOf(home, "國立歷史博物館5樓")).toBe("國立歷史博物館");
    expect(venueOf(home, "2展廳")).toBe("國立歷史博物館");
    expect(venueOf(home, "佛光山佛陀紀念館第二展廳")).toBe("佛光山佛陀紀念館第二展廳");
    expect(venueOf(home, "")).toBe("國立歷史博物館");
  });

  it("展覽：類別一律展覽、通過 ingest 驗證", () => {
    const event = venueEvent(draft);
    expect(event).toMatchObject({ category: "exhibition", startsOn: "2026-06-18", endsOn: "2027-03-28", showTimes: [], ticketUrls: [] });
    expect(validateCollectedEvent(event)).toEqual(event);
    // 標題沒有「展」字也算展覽
    expect(venueEvent({ ...draft, title: "異想物語—館藏動物圖樣的沉浸旅程" })?.category).toBe("exhibition");
  });

  it("常設展不收：沒有結束日、跨度超過上限、標題寫常設展", () => {
    expect(venueEvent({ ...draft, endsOn: null })).toBeNull();
    expect(venueEvent({ ...draft, startsOn: null })).toBeNull();
    expect(venueEvent({ ...draft, startsOn: "2025-01-25", endsOn: "2029-01-31" })).toBeNull();
    expect(MAX_EXHIBITION_SPAN_DAYS).toBe(400);
    expect(venueEvent({ ...draft, startsOn: "2026-01-01", endsOn: "2027-02-05" })).not.toBeNull(); // 400 天整
    expect(venueEvent({ ...draft, startsOn: "2026-01-01", endsOn: "2027-02-06" })).toBeNull(); // 401 天
    expect(venueEvent({ ...draft, title: "在這裡，與大家相遇—國立歷史博物館常設展", endsOn: "2026-12-31" })).toBeNull();
    expect(venueEvent({ ...draft, startsOn: "2026-10-20", endsOn: "2026-10-01" })).toBeNull();
  });

  it("雜訊標題（工作坊、導覽、博覽會）不收；演出照標題推細類", () => {
    expect(venueEvent({ ...draft, title: "【特展工作坊】骨早味動畫社" })).toBeNull();
    expect(venueEvent({ ...draft, title: "2026 台灣國際珍稀茶葉博覽會" })).toBeNull();
    expect(venueEvent({ ...draft, title: "無人劇場《母親樹》", category: "performance" })?.category).toBe("theatre");
  });

  it("開始日太早：一定不收（列表往前翻可以停）", () => {
    expect(startedTooLongAgo("2025-01-01", "2026-10-15")).toBe(true);
    expect(startedTooLongAgo("2026-06-30", "2026-10-15")).toBe(false);
    expect(startedTooLongAgo(null, "2026-10-15")).toBe(true);
  });
});
