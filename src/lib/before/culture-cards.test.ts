import { describe, expect, it } from "vitest";
import type { SelectedCultureEvent } from "@/lib/events/culture";
import type { LiveWorkRow } from "./cards";
import { cultureCard, dropCommunityDuplicates } from "./culture-cards";

const TODAY = "2026-10-14";

function show(overrides: Partial<SelectedCultureEvent> = {}): SelectedCultureEvent {
  const session = overrides.session ?? { start: "2026-10-20", end: null, time: "19:30", venue: "國家音樂廳" };
  return {
    uid: "u1",
    kind: "live",
    festival: false,
    title: "島嶼夜歌",
    imageUrl: null,
    link: { url: "https://www.opentix.life/event/1", ticket: true },
    sessions: [session],
    ...overrides,
    session,
  };
}

function community(overrides: Partial<LiveWorkRow> = {}): LiveWorkRow {
  return {
    id: "w1",
    slug: "s1",
    kind: "live",
    title: "島嶼夜歌",
    venue: "國家音樂廳",
    event_date: "2026-10-20",
    event_end_date: null,
    poster_url: null,
    ...overrides,
  };
}

describe("cultureCard：演出", () => {
  it("meta 演出・場地・日期；排進行程帶名稱、場地、當天場次時間；外連售票", () => {
    const card = cultureCard(show({ session: { start: "2026-10-20", end: null, time: "14:30", venue: "國家音樂廳" } }), TODAY);
    expect(card).toEqual({
      key: "culture:u1",
      title: "島嶼夜歌",
      posterUrl: null,
      meta: "演出・國家音樂廳・10.20",
      placeholder: "live",
      coverDetails: { venue: "國家音樂廳", eventDate: "2026-10-20", eventEndDate: null },
      workId: null,
      plan: { type: "live", place: "live", name: "島嶼夜歌", venue: "國家音樂廳", dates: "2026.10.20", custom: "2026-10-20T14:30" },
      link: { href: "https://www.opentix.life/event/1", label: "購票" },
      fromCulture: true,
    });
  });

  it("場次沒寫時間：預填 19:30；只有活動頁：外連寫「活動頁」；沒有網址不帶", () => {
    const noTime = cultureCard(show({ session: { start: "2026-10-20", end: null, time: null, venue: null }, link: { url: "https://x.example/a", ticket: false } }), TODAY);
    expect(noTime.plan).toMatchObject({ custom: "2026-10-20T19:30", venue: "" });
    expect(noTime.meta).toBe("演出・10.20");
    expect(noTime.link).toEqual({ href: "https://x.example/a", label: "活動頁" });
    expect(cultureCard(show({ link: null }), TODAY).link).toBeUndefined();
  });

  it("音樂祭：meta 寫音樂祭、跨日寫區間、日期欄帶區間", () => {
    const card = cultureCard(
      show({ festival: true, title: "浮現祭", session: { start: "2026-10-24", end: "2026-10-26", time: "12:00", venue: "台中清水鰲峰山" } }),
      TODAY,
    );
    expect(card.meta).toBe("音樂祭・台中清水鰲峰山・10.24 – 10.26");
    expect(card.plan).toMatchObject({ place: "live", dates: "2026.10.24 – 2026.10.26", custom: "2026-10-24T12:00" });
  });

  it("多日場次已經開始：不預填過去的時間", () => {
    const card = cultureCard(show({ session: { start: "2026-10-12", end: "2026-10-16", time: "19:00", venue: "A" } }), TODAY);
    expect(card.plan).toMatchObject({ custom: "" });
  });

  it("有圖就用（不然走字卡）", () => {
    expect(cultureCard(show({ imageUrl: "https://cloud.culture.tw/a.jpg" }), TODAY).posterUrl).toBe("https://cloud.culture.tw/a.jpg");
  });
});

describe("cultureCard：展覽", () => {
  const exhibition = (start: string, end: string | null) =>
    show({ kind: "exhibition", title: "埃及之王", session: { start, end, time: null, venue: "奇美博物館" } });

  it("進行中：展至 MM.DD，日期欄帶展期；不預填日期", () => {
    const card = cultureCard(exhibition("2026-09-01", "2026-11-16"), TODAY);
    expect(card.meta).toBe("展覽・奇美博物館・展至 11.16");
    expect(card.placeholder).toBe("exhibition");
    expect(card.plan).toEqual({ type: "live", place: "exhibition", name: "埃及之王", venue: "奇美博物館", dates: "2026.09.01 – 2026.11.16", custom: "" });
  });

  it("跨年展至寫年份；展期超過一年日期欄留空（記一筆最多一年）", () => {
    const card = cultureCard(exhibition("2024-01-19", "2034-12-31"), TODAY);
    expect(card.meta).toBe("展覽・奇美博物館・展至 2034.12.31");
    expect(card.plan).toMatchObject({ dates: "" });
  });

  it("還沒開展：MM.DD 開展；沒寫結束日只有開始日", () => {
    expect(cultureCard(exhibition("2026-10-30", "2027-01-31"), TODAY).meta).toBe("展覽・奇美博物館・10.30 開展");
    expect(cultureCard(exhibition("2026-10-01", null), TODAY).plan).toMatchObject({ dates: "2026.10.01" });
  });
});

describe("dropCommunityDuplicates：社群場刊已有同名同日的只留場刊", () => {
  it("同類＋名稱正規化相同＋日期相近 → 拿掉文化部那張", () => {
    const events = [show({ title: "「島嶼夜歌」" }), show({ uid: "u2", title: "別的演出" })];
    expect(dropCommunityDuplicates(events, [community()]).map((event) => event.uid)).toEqual(["u2"]);
  });

  it("演出差兩天以上、類型不同、場刊沒日期都不算同一場", () => {
    const events = [show()];
    expect(dropCommunityDuplicates(events, [community({ event_date: "2026-10-23" })])).toHaveLength(1);
    expect(dropCommunityDuplicates(events, [community({ kind: "exhibition" })])).toHaveLength(1);
    expect(dropCommunityDuplicates(events, [community({ event_date: null })])).toHaveLength(1);
  });

  it("展覽 90 天內都算同一檔", () => {
    const expo = show({ kind: "exhibition", title: "埃及之王", session: { start: "2026-09-01", end: "2026-12-31", time: null, venue: "A" } });
    const row = community({ kind: "exhibition", title: "埃及之王", event_date: "2026-10-18" });
    expect(dropCommunityDuplicates([expo], [row])).toEqual([]);
  });
});

describe("cultureCard：多來源活動（KKTIX／OPENTIX／Accupass／北美館）", () => {
  it("key 用 event:、標出處、不算文化部；有售票網址就是「購票」", () => {
    const card = cultureCard({ ...show({ uid: "kktix:Event-1" }), origin: "kktix", ticketCount: 2 }, TODAY);
    expect(card.key).toBe("event:kktix:Event-1");
    expect(card.eventSource).toBe("kktix");
    expect(card.fromCulture).toBeUndefined();
    expect(card.link).toEqual({ href: "https://www.opentix.life/event/1", label: "購票" });
    expect(card.plan).toMatchObject({ type: "live", place: "live", name: "島嶼夜歌", venue: "國家音樂廳", custom: "2026-10-20T19:30" });
  });

  it("北美館沒售票網址：連活動頁；展覽 meta 展至", () => {
    const session = { start: "2026-09-12", end: "2027-01-03", time: null, venue: "臺北市立美術館" };
    const card = cultureCard(
      { ...show({ uid: "tfam:813", kind: "exhibition", title: "王雅慧：旅行者", link: { url: "https://www.tfam.museum/x", ticket: false }, session }), origin: "tfam" },
      TODAY,
    );
    expect(card).toMatchObject({ meta: "展覽・臺北市立美術館・展至 2027.01.03", link: { label: "活動頁" }, eventSource: "tfam", placeholder: "exhibition" });
  });

  it("origin 是 culture 的照舊算文化部", () => {
    const card = cultureCard({ ...show(), origin: "culture" }, TODAY);
    expect(card.key).toBe("culture:u1");
    expect(card.fromCulture).toBe(true);
    expect(card.eventSource).toBeUndefined();
  });
});

describe("cultureCard：演出細類（小標籤用；meta 不變）", () => {
  it("有細類就帶 subcategory，meta 照舊寫演出", () => {
    const card = cultureCard(show({ category: "theatre", title: "夜行" }), TODAY);
    expect(card.subcategory).toBe("theatre");
    expect(card.meta).toBe("演出・國家音樂廳・10.20");
  });

  it("一般演出、展覽沒有 subcategory", () => {
    expect(cultureCard(show({ category: "performance" }), TODAY).subcategory).toBeUndefined();
    expect(cultureCard(show({ kind: "exhibition", category: "exhibition" }), TODAY).subcategory).toBeUndefined();
  });
});

describe("cultureCard：meta 補縣市簡稱（放場地前面）", () => {
  const at = (city: string | null, venue = "駁二正倉庫") => ({ start: "2026-10-21", end: null, time: "19:30", venue, city });

  it("演出：演出・高雄・駁二正倉庫・10.21", () => {
    expect(cultureCard(show({ session: at("高雄市") }), TODAY).meta).toBe("演出・高雄・駁二正倉庫・10.21");
  });

  it("音樂祭、展覽也加；縣保留「縣」區分同名市", () => {
    expect(cultureCard(show({ festival: true, session: at("新竹縣", "竹北體育場") }), TODAY).meta).toBe("音樂祭・新竹縣・竹北體育場・10.21");
    const expo = show({ kind: "exhibition", session: { start: "2026-10-01", end: "2026-11-30", time: null, venue: "嘉義市立美術館", city: "嘉義縣" } });
    expect(cultureCard(expo, TODAY).meta).toBe("展覽・嘉義縣・嘉義市立美術館・展至 11.30");
  });

  it("場地名已經有縣市就不重複（臺北市立美術館、台北小巨蛋）", () => {
    expect(cultureCard(show({ session: at("臺北市", "臺北市立美術館") }), TODAY).meta).toBe("演出・臺北市立美術館・10.21");
    expect(cultureCard(show({ session: at("臺北市", "台北小巨蛋") }), TODAY).meta).toBe("演出・台北小巨蛋・10.21");
  });

  it("沒有縣市資料照舊；沒有場地也照樣加縣市", () => {
    expect(cultureCard(show({ session: at(null) }), TODAY).meta).toBe("演出・駁二正倉庫・10.21");
    expect(cultureCard(show({ session: { start: "2026-10-21", end: null, time: null, venue: null, city: "臺南市" } }), TODAY).meta).toBe("演出・臺南・10.21");
  });
});
