import { describe, expect, it } from "vitest";
import { fromTaipei } from "./time";
import {
  adjacentMonth,
  buildCalendar,
  entryByline,
  entryMeta,
  entryTime,
  entryTitle,
  groupByDate,
  monthStatLine,
  monthSubLine,
  monthTitle,
  pendingEntries,
  type JournalViewEntry,
} from "./view";

const at = (month: number, day: number, hour: number, minute = 0) =>
  fromTaipei(2026, month, day, hour, minute).toISOString();

let seq = 0;
function entry(overrides: Partial<JournalViewEntry> = {}): JournalViewEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    experiencedAt: at(10, 7, 21, 40),
    venue: "cinema",
    status: "recorded",
    companions: null,
    titleFallback: null,
    work: { kind: "movie", title: "海街日記", podcast_show: null, episode_number: null, poster_url: null },
    article: null,
    ...overrides,
  };
}

const podcast = (n: number) => ({
  kind: "podcast_episode" as const,
  title: `第 ${n} 集標題`,
  podcast_show: "慢慢說",
  episode_number: n,
  poster_url: null,
});

describe("entryTitle / entryMeta / entryTime", () => {
  it("電影用片名", () => {
    expect(entryTitle(entry())).toBe("海街日記");
  });

  it("Podcast：節目名・第 n 集", () => {
    expect(entryTitle(entry({ work: podcast(121) }))).toBe("慢慢說・第 121 集");
  });

  it("影集有集數也帶", () => {
    expect(
      entryTitle(
        entry({ work: { kind: "series", title: "請回答1988", podcast_show: null, episode_number: 20, poster_url: null } }),
      ),
    ).toBe("請回答1988・第 20 集");
  });

  it("只記名稱 → 後備名稱", () => {
    expect(entryTitle(entry({ work: null, titleFallback: "夜車上的海" }))).toBe("夜車上的海");
  });

  it("meta：類型・場域", () => {
    expect(entryMeta(entry())).toBe("電影・電影院");
    expect(entryMeta(entry({ work: podcast(1), venue: "commute" }))).toBe("Podcast・通勤路上");
    expect(entryMeta(entry({ work: null, titleFallback: "島嶼夜歌", venue: "live" }))).toBe("演出・音樂祭/演出");
  });

  it("時間 HH:MM（台北）", () => {
    expect(entryTime(entry())).toBe("21:40");
  });
});

describe("entryByline", () => {
  it("說成了文章 → 時間差署名", () => {
    expect(
      entryByline(
        entry({ status: "said", article: { href: "/s/x", saidAt: at(10, 7, 21, 58), typed: false } }),
      ),
    ).toBe("10.07 在電影院看完・散場後 18 分鐘說的");
  });

  it("沒有文章 → 空字串", () => {
    expect(entryByline(entry())).toBe("");
  });
});

describe("月份刊頭", () => {
  const entries = [
    entry(),
    entry({ status: "said" }),
    entry({ work: { kind: "series", title: "請回答1988", podcast_show: null, episode_number: 20, poster_url: null } }),
    entry({ work: podcast(1) }),
    entry({ work: podcast(2), status: "said" }),
    entry({ work: null, titleFallback: "草地音樂會", venue: "live" }),
    entry({ work: null, titleFallback: "光的抄寫", venue: "exhibition", status: "skipped" }),
  ];

  it("統計句：看了 3 部、聽了 2 集、去了 2 場。其中 2 筆，說成了文章。", () => {
    expect(monthStatLine(entries)).toBe("看了 3 部、聽了 2 集、去了 2 場。其中 2 筆，說成了文章。");
  });

  it("沒有的類型略過、沒有文章不寫後半", () => {
    expect(monthStatLine([entry()])).toBe("看了 1 部。");
  });

  it("空月份", () => {
    expect(monthStatLine([])).toBe("這個月還沒有紀錄。");
    expect(monthSubLine([])).toBe("第一筆會出現在這裡");
  });

  it("副標：7 筆紀錄・2 篇文章；沒文章只寫筆數", () => {
    expect(monthSubLine(entries)).toBe("7 筆紀錄・2 篇文章");
    expect(monthSubLine([entry()])).toBe("1 筆紀錄");
  });

  it("月份標題：10 月", () => {
    expect(monthTitle("2026-10")).toEqual({ name: "10 月", year: "2026" });
    expect(monthTitle("2026-01")).toEqual({ name: "1 月", year: "2026" });
    expect(monthTitle("2026-12")).toEqual({ name: "12 月", year: "2026" });
  });

  it("前後月跨年", () => {
    expect(adjacentMonth("2026-01", -1)).toBe("2025-12");
    expect(adjacentMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("buildCalendar", () => {
  const now = fromTaipei(2026, 10, 9, 20);

  it("10 月 1 日是週四 → 前面空 4 格；31 天", () => {
    const calendar = buildCalendar("2026-10", [], now);
    expect(calendar.leading).toBe(4);
    expect(calendar.days).toHaveLength(31);
  });

  it("今天、未來、記號（最多 3 個）、說成文章的點", () => {
    const entries = [
      entry({ experiencedAt: at(10, 6, 8) , work: podcast(1) }),
      entry({ experiencedAt: at(10, 6, 19), work: null, titleFallback: "光", venue: "exhibition" }),
      entry({ experiencedAt: at(10, 7, 21), status: "said" }),
      entry({ experiencedAt: at(10, 5, 10) }),
      entry({ experiencedAt: at(10, 5, 12) }),
      entry({ experiencedAt: at(10, 5, 14) }),
      entry({ experiencedAt: at(10, 5, 16) }),
    ];
    const { days } = buildCalendar("2026-10", entries, now);
    const day = (n: number) => days[n - 1];
    expect(day(9).isToday).toBe(true);
    expect(day(10).isFuture).toBe(true);
    expect(day(9).isFuture).toBe(false);
    expect(day(6).marks).toEqual(["podcast", "exhibition"]);
    expect(day(7).hasArticle).toBe(true);
    expect(day(6).hasArticle).toBe(false);
    expect(day(5).marks).toEqual(["screen", "screen", "screen"]);
    expect(day(5).count).toBe(4);
    expect(day(5).dateKey).toBe("2026-10-05");
    expect(day(5).weekday).toBe("週一");
  });

  it("過去的月份沒有未來格", () => {
    const { days } = buildCalendar("2026-09", [], now);
    expect(days.some((d) => d.isFuture || d.isToday)).toBe(false);
  });
});

describe("groupByDate / pendingEntries", () => {
  const a = entry({ id: "a", experiencedAt: at(10, 7, 21, 40) });
  const b = entry({ id: "b", experiencedAt: at(10, 7, 23, 10), status: "skipped" });
  const c = entry({ id: "c", experiencedAt: at(10, 8, 22, 30) });
  const d = entry({ id: "d", experiencedAt: at(10, 4, 19, 30), status: "said" });

  it("依日期倒序、同日時間倒序", () => {
    const groups = groupByDate([a, b, c, d]);
    expect(groups.map((g) => [g.label, g.weekday])).toEqual([
      ["10.08", "週四"],
      ["10.07", "週三"],
      ["10.04", "週日"],
    ]);
    expect(groups[1].entries.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("還沒說的：只取 recorded、新到舊", () => {
    expect(pendingEntries([a, b, c, d]).map((e) => e.id)).toEqual(["c", "a"]);
  });
});
