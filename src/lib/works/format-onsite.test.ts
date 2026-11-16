import { describe, expect, it } from "vitest";
import {
  formatEventDate,
  isOnSite,
  isScreen,
  KIND_LABELS,
  onSiteInfoRows,
  pickerKindForWork,
  posterCardLabel,
  posterCardNumber,
  workMetaLine,
  workVerb,
  type WorkKind,
} from "./format";

const base = {
  year: null,
  region: null,
  credit: null,
  podcast_show: null,
  episode_number: null,
  title: "大港開唱",
};

describe("演出／展覽作品類型", () => {
  it("KIND_LABELS 涵蓋全部五種", () => {
    const kinds: WorkKind[] = ["movie", "series", "podcast_episode", "live", "exhibition"];
    expect(kinds.map((kind) => KIND_LABELS[kind])).toEqual(["電影", "影集", "PODCAST", "演出", "展覽"]);
  });

  it("動詞：演出「聽」（與日誌音樂祭「聽完」一致）、展覽「看」", () => {
    expect(workVerb({ kind: "live" })).toBe("聽");
    expect(workVerb({ kind: "exhibition" })).toBe("看");
    expect(workVerb({ kind: "movie" })).toBe("看");
    expect(workVerb({ kind: "series" })).toBe("看");
    expect(workVerb({ kind: "podcast_episode" })).toBe("聽");
  });

  it("isOnSite / isScreen 分類", () => {
    expect(isOnSite({ kind: "live" })).toBe(true);
    expect(isOnSite({ kind: "exhibition" })).toBe(true);
    expect(isOnSite({ kind: "movie" })).toBe(false);
    expect(isScreen({ kind: "series" })).toBe(true);
    expect(isScreen({ kind: "live" })).toBe(false);
    expect(isScreen({ kind: "podcast_episode" })).toBe(false);
  });

  it("pickerKindForWork：podcast_episode→podcast、series→series、現場類與 null→movie", () => {
    expect(pickerKindForWork({ kind: "podcast_episode" })).toBe("podcast");
    expect(pickerKindForWork({ kind: "series" })).toBe("series");
    expect(pickerKindForWork({ kind: "movie" })).toBe("movie");
    expect(pickerKindForWork({ kind: "live" })).toBe("movie");
    expect(pickerKindForWork({ kind: "exhibition" })).toBe("movie");
    expect(pickerKindForWork(null)).toBe("movie");
    expect(pickerKindForWork(undefined)).toBe("movie");
  });

  it("formatEventDate：YYYY-MM-DD → YYYY.MM.DD；空或格式不符回 null", () => {
    expect(formatEventDate("2026-03-28")).toBe("2026.03.28");
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate("")).toBeNull();
    expect(formatEventDate("3/28")).toBeNull();
  });

  it("onSiteInfoRows：只列有值的場地／日期", () => {
    expect(onSiteInfoRows({ venue: "高雄駁二", event_date: "2026-03-28" })).toEqual([
      { label: "場地", value: "高雄駁二" },
      { label: "日期", value: "2026.03.28" },
    ]);
    expect(onSiteInfoRows({ venue: null, event_date: "2026-03-28" })).toEqual([
      { label: "日期", value: "2026.03.28" },
    ]);
    expect(onSiteInfoRows({ venue: null, event_date: null })).toEqual([]);
  });

  it("meta 行：現場類為「日期 · 場地」，不出現導演", () => {
    expect(
      workMetaLine({ ...base, kind: "live", credit: "某某", venue: "高雄駁二", event_date: "2026-03-28" }),
    ).toBe("2026.03.28 · 高雄駁二");
    expect(workMetaLine({ ...base, kind: "exhibition", venue: null, event_date: null })).toBe("");
  });

  it("字卡：側標用場地、大字用年份或活動年份", () => {
    expect(posterCardLabel({ kind: "live", episode_number: null, region: "台灣", venue: "高雄駁二" })).toBe(
      "演出・高雄駁二",
    );
    expect(posterCardLabel({ kind: "exhibition", episode_number: null, region: null, venue: null })).toBe("展覽");
    expect(posterCardNumber({ kind: "live", episode_number: null, year: null, event_date: "2026-03-28" })).toBe(
      "2026",
    );
    expect(posterCardNumber({ kind: "exhibition", episode_number: null, year: null, event_date: null })).toBe("—");
  });
});
