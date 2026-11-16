import { describe, expect, it } from "vitest";
import { coverDateLabel, coverModel, coverStyleOf, pickPodcastCover, titleOrientation, verticalTitleColumns } from "./cover";

describe("pickPodcastCover：封面來源優先序", () => {
  it("iTunes 600 優先", () => {
    expect(pickPodcastCover("https://is1.mzstatic.com/a/600x600bb.jpg", "https://feed.example/cover.jpg")).toBe(
      "https://is1.mzstatic.com/a/600x600bb.jpg",
    );
  });
  it("iTunes 沒有 → RSS itunes:image", () => {
    expect(pickPodcastCover(null, "https://feed.example/cover.jpg")).toBe("https://feed.example/cover.jpg");
  });
  it("空白字串與非 http 網址不算", () => {
    expect(pickPodcastCover("  ", "javascript:alert(1)")).toBeNull();
    expect(pickPodcastCover("ftp://x/a.jpg", "http://feed.example/a.png")).toBe("http://feed.example/a.png");
  });
  it("兩邊都沒有 → null", () => {
    expect(pickPodcastCover(null, null)).toBeNull();
  });
});

describe("verticalTitleColumns：字卡直排切行", () => {
  it("短名一欄", () => {
    expect(verticalTitleColumns("霸王別姬", 6, 2)).toEqual(["霸王別姬"]);
  });
  it("超過一欄長度依序切欄", () => {
    expect(verticalTitleColumns("島嶼夜歌草地音樂會", 5, 2)).toEqual(["島嶼夜歌草", "地音樂會"]);
  });
  it("有分隔號時在分隔號斷欄，分隔號本身不出現", () => {
    expect(verticalTitleColumns("島嶼夜歌・草地音樂會", 6, 2)).toEqual(["島嶼夜歌", "草地音樂會"]);
  });
  it("超過欄數上限，最後一欄以刪節號收尾", () => {
    expect(verticalTitleColumns("一二三四五六七八九十", 3, 2)).toEqual(["一二三", "四五…"]);
  });
  it("空白合併、前後去掉；空字串回空陣列", () => {
    expect(verticalTitleColumns("  ", 4, 2)).toEqual([]);
    expect(verticalTitleColumns(" 海  邊 ", 4, 1)).toEqual(["海 邊"]);
  });
  it("英文字整個字一起排、以約半字寬計，不從字中間切欄（UX-25）；emoji 不切半", () => {
    expect(verticalTitleColumns("Dune😀", 3, 2)).toEqual(["Dune", "😀"]);
    expect(verticalTitleColumns("uxaudit 測試演出", 5, 2)).toEqual(["uxaudit", "測試演出"]);
    expect(verticalTitleColumns("uxaudit 測試演出", 6, 2)).toEqual(["uxaudit", "測試演出"]);
  });
  it("比一欄還長的英文字才照字數切", () => {
    expect(verticalTitleColumns("Supercalifragilistic", 5, 3)).toEqual(["Supercali", "fragilist", "ic"]);
  });
  it("英文字超過欄數上限：最後一欄去掉放不下的字再加刪節號", () => {
    expect(verticalTitleColumns("海街 The Last Tour 日記", 4, 2)).toEqual(["海街 The", "Last…"]);
  });
});

describe("titleOrientation：英文為主的片名改橫排（UX-25）", () => {
  it("中文為主直排", () => {
    expect(titleOrientation("霸王別姬")).toBe("vertical");
    expect(titleOrientation("uxaudit 測試演出")).toBe("vertical");
    expect(titleOrientation("007：生死交戰")).toBe("vertical");
  });
  it("英文為主橫排", () => {
    expect(titleOrientation("Past Lives")).toBe("horizontal");
    expect(titleOrientation("Dune 2")).toBe("horizontal");
  });
});

describe("coverStyleOf", () => {
  it("依作品類型給字卡樣式", () => {
    expect(coverStyleOf("movie")).toBe("screen");
    expect(coverStyleOf("series")).toBe("screen");
    expect(coverStyleOf("podcast_episode")).toBe("podcast");
    expect(coverStyleOf("podcast")).toBe("podcast");
    expect(coverStyleOf("live")).toBe("live");
    expect(coverStyleOf("performance")).toBe("live");
    expect(coverStyleOf("exhibition")).toBe("exhibition");
    expect(coverStyleOf("unknown")).toBe("screen");
  });
});

describe("coverDateLabel", () => {
  it("單日 MM.DD、區間 MM.DD – MM.DD、同日視為單日", () => {
    expect(coverDateLabel("2026-10-09", null)).toBe("10.09");
    expect(coverDateLabel("2026-10-09", "2026-10-10")).toBe("10.09 – 10.10");
    expect(coverDateLabel("2026-10-09", "2026-10-09")).toBe("10.09");
  });
  it("沒日期或格式不對 → null", () => {
    expect(coverDateLabel(null, null)).toBeNull();
    expect(coverDateLabel("十月", null)).toBeNull();
  });
});

describe("coverModel", () => {
  it("有封面網址 → 圖", () => {
    expect(coverModel({ kind: "movie", title: "沙丘", posterUrl: "https://image.tmdb.org/p.jpg" }, "md")).toEqual({
      type: "image",
      url: "https://image.tmdb.org/p.jpg",
    });
  });
  it("沒封面 → 字卡：直排作品名＋場地＋日期", () => {
    expect(
      coverModel(
        { kind: "live", title: "島嶼夜歌・草地音樂會", posterUrl: null, venue: "大佳河濱公園", eventDate: "2026-10-09", eventEndDate: "2026-10-10" },
        "lg",
      ),
    ).toEqual({
      type: "card",
      style: "live",
      orientation: "vertical",
      columns: ["島嶼夜歌", "草地音樂會"],
      venue: "大佳河濱公園",
      date: "10.09 – 10.10",
      label: "演出",
    });
  });
  it("封面網址不是 http(s) → 當作沒有", () => {
    expect(coverModel({ kind: "exhibition", title: "光", posterUrl: "data:image/png;base64,xx" }, "sm").type).toBe("card");
  });
  it("最小尺寸只留一欄、不帶場地日期", () => {
    expect(
      coverModel({ kind: "exhibition", title: "城市與光的對話展", posterUrl: null, venue: "北美館", eventDate: "2026-10-01" }, "xs"),
    ).toEqual({
      type: "card",
      style: "exhibition",
      orientation: "vertical",
      columns: ["城市…"],
      venue: null,
      date: null,
      label: "展覽",
    });
  });
  it("影劇字卡標類型、不帶場地", () => {
    const model = coverModel({ kind: "series", title: "影后", posterUrl: null, venue: "x" }, "md");
    expect(model).toMatchObject({ type: "card", style: "screen", label: "影集", venue: null });
  });
  it("Podcast 字卡用節目名（呼叫端給）", () => {
    expect(coverModel({ kind: "podcast_episode", title: "百靈果", posterUrl: null }, "md")).toMatchObject({
      style: "podcast",
      label: "Podcast",
      columns: ["百靈果"],
    });
  });
  it("英文片名：橫排一行，交給版面換行", () => {
    expect(coverModel({ kind: "movie", title: "Past  Lives", posterUrl: null }, "sm")).toMatchObject({
      orientation: "horizontal",
      columns: ["Past Lives"],
    });
  });
});

describe("音樂字卡（Q-61）", () => {
  it("music → 音樂樣式與標籤；沒封面時字卡直排專輯名", () => {
    expect(coverStyleOf("music")).toBe("music");
    const model = coverModel({ kind: "music", title: "要去什麼地方", posterUrl: null }, "md");
    expect(model).toMatchObject({ type: "card", style: "music", label: "音樂", venue: null, date: null });
  });
});
