import { describe, expect, it } from "vitest";
import { buildProgramme, formatProgrammeDates, type ProgrammeWork } from "./programme";
import type { ProgrammeFeeling } from "./programme-groups";

const baseWork: ProgrammeWork = {
  id: "w1",
  kind: "live",
  title: "島嶼夜歌・草地音樂會",
  slug: "manual-live-abc-1",
  issue_no: 31,
  venue: "台北・大佳河濱公園 草地舞台",
  event_date: "2026-10-09",
  event_end_date: "2026-10-10",
};

const feeling = (over: Partial<ProgrammeFeeling>): ProgrammeFeeling => ({
  episodeId: "e1",
  shareSlug: "s1",
  title: "《島嶼夜歌・草地音樂會》——草地上的最後一首歌",
  pullQuote: "最後一首唱完，燈沒有馬上亮。",
  author: "晚安",
  penName: "晚安",
  glyph: null,
  createdAt: "2026-10-10T14:22:00Z",
  publishedAt: "2026-10-10T14:23:00Z",
  experiencedAt: "2026-10-10T14:04:00Z",
  typed: false,
  ...over,
});

const NOW = new Date("2026-10-10T14:41:00Z");

describe("formatProgrammeDates", () => {
  it("演出帶星期；跨日只寫一次年份", () => {
    expect(formatProgrammeDates("2026-10-09", "2026-10-10", true)).toBe("2026.10.09（五）– 10.10（六）");
    expect(formatProgrammeDates("2026-10-09", null, true)).toBe("2026.10.09（五）");
  });

  it("展期不帶星期；跨年寫完整年份", () => {
    expect(formatProgrammeDates("2026-09-12", "2026-11-30", false)).toBe("2026.09.12 – 11.30");
    expect(formatProgrammeDates("2026-12-20", "2027-01-05", false)).toBe("2026.12.20 – 2027.01.05");
    expect(formatProgrammeDates(null, null, false)).toBeNull();
  });
});

describe("buildProgramme：音樂祭（A）", () => {
  const rows = [
    feeling({ episodeId: "a" }),
    feeling({ episodeId: "b", penName: "呂呂", author: "呂呂", experiencedAt: "2026-10-09T14:00:00Z", createdAt: "2026-10-10T03:00:00Z", publishedAt: "2026-10-10T03:00:00Z" }),
  ];
  const view = buildProgramme(baseWork, rows, NOW);

  it("刊頭：多日演出叫音樂祭、期號、標題斷行、字卡", () => {
    expect(view.eyebrow).toBe("場外・音樂祭");
    expect(view.issue).toBe("場刊 第 0031 號");
    expect(view.titleLines).toEqual(["島嶼夜歌・", "草地音樂會"]);
    expect(view.plate).toBe("島嶼夜歌");
    expect(view.plateMark).toBe("10 月 9 日・10 日");
  });

  it("場地／日期兩列（沒有資料源，不列時間）", () => {
    expect(view.facts).toEqual([
      { label: "場地", value: "台北・大佳河濱公園 草地舞台" },
      { label: "日期", value: "2026.10.09（五）– 10.10（六）" },
    ]);
  });

  it("最後一晚有人散場 → 已散場戳，時間取最早記下的散場時刻", () => {
    expect(view.stamp).toEqual({ date: "10.10", time: "22:04" });
  });

  it("統計：收錄、同場（晚數＋人數）、最近一段", () => {
    expect(view.stats).toEqual([
      { label: "收錄", value: "2 段感受", big: true },
      { label: "同場", value: "2 晚 2 人", big: false },
      { label: "最近一段", value: "18 分鐘前", big: false },
    ]);
  });

  it("人與感受分組、標題去掉作品名", () => {
    expect(view.peopleTitle).toBe("這場散場的人");
    expect(view.peopleDek).toBe("2 個晚上，2 個人待到散場，各自說了一段。");
    expect(view.groups.map((group) => [group.label, group.countLabel])).toEqual([
      ["第 2 晚", "1 人"],
      ["第 1 晚", "1 人"],
    ]);
    expect(view.groups[0].rows[0].title).toBe("草地上的最後一首歌");
    expect(view.groups[0].rows[0].sig).toBe("10.10 散場・18 分鐘後說的");
    expect(view.groups[0].feelingCountLabel).toBe("1 段");
  });

  it("CTA 與頁尾", () => {
    expect(view.cta).toMatchObject({ kicker: "第 3 段，可以是你的", lines: ["你也在", "那一場？"], sub: "已帶入「島嶼夜歌・草地音樂會」" });
    expect(view.footNo).toBe("場刊 No.0031");
    expect(view.footLine).toBe("「島嶼夜歌・草地音樂會」・收錄 2 段感受");
  });

  it("單日演出叫演出；還沒有人說時沒有戳", () => {
    const single = buildProgramme({ ...baseWork, event_end_date: null, event_date: "2026-10-12" }, [], NOW);
    expect(single.eyebrow).toBe("場外・演出");
    expect(single.stamp).toBeNull();
    expect(single.peopleDek).toBe("還沒有人說過這一場。第一段，可以是你的。");
    expect(single.footLine).toBe("「島嶼夜歌・草地音樂會」・等待第一段");
  });
});

describe("buildProgramme：展覽（B）", () => {
  const work: ProgrammeWork = { ...baseWork, kind: "exhibition", title: "光的抄寫・攝影展", event_date: "2026-09-12", event_end_date: "2026-11-30" };
  const rows = [feeling({ penName: "雨青", author: "雨青", experiencedAt: "2026-10-06T07:00:00Z", createdAt: "2026-10-07T03:00:00Z", publishedAt: "2026-10-07T03:00:00Z" })];

  it("展期中：還有幾天、沒有戳、看過的人", () => {
    const view = buildProgramme(work, rows, NOW);
    expect(view.eyebrow).toBe("場外・展覽");
    expect(view.plateMark).toBe("展期中・還有 51 天");
    expect(view.stamp).toBeNull();
    expect(view.facts[1]).toEqual({ label: "展期", value: "2026.09.12 – 11.30" });
    expect(view.peopleTitle).toBe("看過這檔展的人");
    expect(view.peopleDek).toBe("展期還沒結束。之後走出這個展間的人，也會排在這裡。");
    expect(view.stats[1]).toEqual({ label: "看過的人", value: "1 人", big: false });
    expect(view.groups[0].label).toBe("展期中");
    expect(view.cta.lines).toEqual(["你也看過", "這檔展？"]);
    expect(view.cta.body).toBe("展期還有 51 天。看完走出展間的那一刻，說一段。");
  });

  it("閉展後：已散場戳、組名「展期」", () => {
    const view = buildProgramme(work, rows, new Date("2026-12-05T04:00:00Z"));
    expect(view.plateMark).toBe("已閉展");
    expect(view.stamp).toEqual({ date: "11.30", time: null });
    expect(view.groups[0].label).toBe("展期");
  });
});


describe("封面補齊：場刊封面", () => {
  it("有封面網址 → view 帶 posterUrl；沒有為 null（走字卡）", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(buildProgramme({ ...baseWork, poster_url: "https://covers/x.jpg" }, [], now).posterUrl).toBe("https://covers/x.jpg");
    expect(buildProgramme(baseWork, [], now).posterUrl).toBeNull();
    expect(buildProgramme(baseWork, [], now).kind).toBe("live");
  });
});
