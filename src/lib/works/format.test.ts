import { describe, expect, it } from "vitest";
import {
  avatarInitial,
  formatIssueLatin,
  formatIssueNo,
  heroTitleStyle,
  posterCardLabel,
  posterCardNumber,
  relativeTimeLabel,
  stripWorkTitle,
  workDisplayName,
  workMetaLine,
} from "./format";

const movie = {
  kind: "movie" as const,
  title: "海街日記",
  year: 2015,
  region: "日本",
  credit: "是枝裕和",
  podcast_show: null,
  episode_number: null,
};

const podcast = {
  kind: "podcast_episode" as const,
  title: "搬回家住的第一年",
  year: null,
  region: null,
  credit: "阿寬",
  podcast_show: "慢慢說",
  episode_number: 121,
};

describe("期號格式化", () => {
  it("142 → 第 0142 號（補足 4 位）", () => {
    expect(formatIssueNo(142)).toBe("第 0142 號");
    expect(formatIssueNo(1)).toBe("第 0001 號");
  });
  it("超過 4 位不截斷", () => {
    expect(formatIssueNo(12345)).toBe("第 12345 號");
  });
  it("已是字串的期號照寫", () => {
    expect(formatIssueNo("4821")).toBe("第 4821 號");
  });
  it("拉丁期號補零", () => {
    expect(formatIssueLatin(142)).toBe("0142");
    expect(formatIssueLatin(-3)).toBe("0000");
  });
});

describe("作品 meta", () => {
  it("電影：年份 · 地區 · 導演", () => {
    expect(workMetaLine(movie)).toBe("2015 · 日本 · 是枝裕和 導演");
  });
  it("Podcast：節目第 N 集 · 主持人", () => {
    expect(workMetaLine(podcast)).toBe("《慢慢說》第 121 集 · 主持人 阿寬");
  });
  it("缺欄位時略過", () => {
    expect(workMetaLine({ ...movie, region: null, credit: null })).toBe("2015");
  });
  it("稱呼", () => {
    expect(workDisplayName(movie)).toBe("《海街日記》");
    expect(workDisplayName(podcast)).toBe("《慢慢說》第 121 集");
    expect(workDisplayName({ ...podcast, episode_number: null })).toBe(
      "《慢慢說》這一集",
    );
  });
  it("字卡：集數優先、其次年份", () => {
    expect(posterCardNumber(podcast)).toBe("121");
    expect(posterCardNumber(movie)).toBe("2015");
    expect(posterCardNumber({ ...movie, year: null })).toBe("—");
    expect(posterCardLabel(podcast)).toBe("PODCAST・第 121 集");
    expect(posterCardLabel(movie)).toBe("電影・日本");
  });
});

describe("hero 標題", () => {
  it("短標題直排、字距較寬", () => {
    expect(heroTitleStyle("海街日記")).toEqual({ vertical: true, letterSpacing: "0.32em" });
  });
  it("8 字直排字距 .18em", () => {
    expect(heroTitleStyle("搬回家住的第一年").letterSpacing).toBe("0.18em");
  });
  it("過長（含英文長標題）改橫排", () => {
    expect(heroTitleStyle("A Failed Execution and the Future of the Death Penalty").vertical).toBe(false);
  });
});

describe("時間標籤", () => {
  const now = new Date("2026-10-09T12:00:00+08:00");
  it("小時內 / 小時前 / 昨天 / 日期", () => {
    expect(relativeTimeLabel("2026-10-09T11:59:40+08:00", now)).toBe("剛剛");
    expect(relativeTimeLabel("2026-10-09T11:30:00+08:00", now)).toBe("30 分鐘前");
    expect(relativeTimeLabel("2026-10-09T10:00:00+08:00", now)).toBe("2 小時前");
    expect(relativeTimeLabel("2026-10-08T10:00:00+08:00", now)).toBe("昨天");
    expect(relativeTimeLabel("2026-10-02T10:00:00+08:00", now)).toBe("10.02");
    expect(relativeTimeLabel("2025-12-31T10:00:00+08:00", now)).toBe("2025.12.31");
  });
  it("無效日期", () => {
    expect(relativeTimeLabel("not-a-date", now)).toBe("—");
  });
});

describe("去作品名", () => {
  it("丟掉含作品名的段落", () => {
    expect(
      stripWorkTitle("散場後我多坐了三分鐘——《海街日記》與那些「一直都在」的人", "海街日記"),
    ).toBe("散場後我多坐了三分鐘");
  });
  it("整段都是作品名時只刪字樣", () => {
    expect(stripWorkTitle("看完《海街日記》，我傳了訊息給姊姊", "海街日記")).toBe(
      "看完，我傳了訊息給姊姊",
    );
  });
  it("不含作品名則原樣", () => {
    expect(stripWorkTitle("第二次看，我站在大姊那一邊了", "海街日記")).toBe(
      "第二次看，我站在大姊那一邊了",
    );
  });
});

describe("頭像字", () => {
  it("中文取最後一字、英文取首字母", () => {
    expect(avatarInitial("林小晴")).toBe("晴");
    expect(avatarInitial("kai")).toBe("K");
    expect(avatarInitial("  ")).toBe("？");
  });
});
