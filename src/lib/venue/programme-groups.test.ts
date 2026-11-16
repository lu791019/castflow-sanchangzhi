import { describe, expect, it } from "vitest";
import { feelingSig, groupProgramme, PEOPLE_ROW_MAX, type ProgrammeFeeling } from "./programme-groups";

const feeling = (over: Partial<ProgrammeFeeling>): ProgrammeFeeling => ({
  episodeId: "e1",
  shareSlug: "s1",
  title: "草地上的最後一首歌",
  pullQuote: null,
  author: "晚安",
  penName: "晚安",
  glyph: null,
  createdAt: "2026-10-10T14:22:00Z",
  publishedAt: "2026-10-10T14:30:00Z",
  experiencedAt: "2026-10-10T14:04:00Z",
  typed: false,
  ...over,
});

// 台北 10/10 22:41
const NOW = new Date("2026-10-10T14:41:00Z");

describe("feelingSig", () => {
  it("演出：MM.DD 散場・N 分鐘後說的", () => {
    expect(feelingSig(feeling({}), "live")).toBe("10.10 散場・18 分鐘後說的");
  });

  it("演出：隔天、幾天後；用打的寫「寫的」", () => {
    expect(feelingSig(feeling({ createdAt: "2026-10-11T05:00:00Z" }), "live")).toBe("10.10 散場・隔天說的");
    expect(feelingSig(feeling({ createdAt: "2026-10-13T05:00:00Z", typed: true }), "live")).toBe("10.10 散場・3 天後寫的");
  });

  it("同一晚超過一小時：當晚", () => {
    expect(feelingSig(feeling({ createdAt: "2026-10-10T16:30:00Z" }), "live")).toBe("10.10 散場・當晚說的");
  });

  it("展覽：MM.DD 時段看完・…", () => {
    const visit = feeling({ experiencedAt: "2026-10-06T07:00:00Z", createdAt: "2026-10-06T07:30:00Z" });
    expect(feelingSig(visit, "exhibition")).toBe("10.06 下午看完・30 分鐘後說的");
  });

  it("沒有連日誌：只寫哪天說的", () => {
    expect(feelingSig(feeling({ experiencedAt: null }), "live")).toBe("10.10 說的");
  });
});

describe("groupProgramme：演出以晚分組（4 點換日）", () => {
  const rows = [
    feeling({ episodeId: "a", penName: "晚安", author: "晚安", experiencedAt: "2026-10-10T14:04:00Z" }),
    feeling({ episodeId: "b", penName: "阿哲", author: "阿哲", experiencedAt: "2026-10-10T17:30:00Z" }), // 台北 10/11 01:30 → 10/10 那晚
    feeling({ episodeId: "c", penName: "呂呂", author: "呂呂", experiencedAt: "2026-10-09T14:00:00Z" }),
    feeling({ episodeId: "d", penName: null, author: "匿名", experiencedAt: "2026-10-09T14:10:00Z" }),
    feeling({ episodeId: "e", penName: "呂呂", author: "呂呂", experiencedAt: "2026-10-09T14:20:00Z" }),
  ];
  const groups = groupProgramme(rows, "live", NOW);

  it("新的一晚在前；第幾晚依時間順序；今晚標「今晚」", () => {
    expect(groups.map((group) => group.label)).toEqual(["第 2 晚", "第 1 晚"]);
    expect(groups.map((group) => group.dateLabel)).toEqual(["10.10・今晚", "10.09"]);
  });

  it("感受列含匿名；印章列只放筆名署名、同一人只出現一次", () => {
    expect(groups[1].feelings.map((row) => row.episodeId)).toEqual(["e", "d", "c"]);
    expect(groups[1].people.map((person) => person.penName)).toEqual(["呂呂"]);
    expect(groups[0].people.map((person) => person.penName)).toEqual(["阿哲", "晚安"]);
  });

  it("只有一晚時叫「當晚」", () => {
    const single = groupProgramme([rows[0]], "live", NOW);
    expect(single[0].label).toBe("當晚");
  });

  it(`印章列最多 ${PEOPLE_ROW_MAX} 人，其餘收成「另外 N 人」`, () => {
    const many = Array.from({ length: 13 }, (_, index) =>
      feeling({ episodeId: `m${index}`, penName: `人${index}`, author: `人${index}` }),
    );
    const [group] = groupProgramme(many, "live", NOW);
    expect(group.people).toHaveLength(PEOPLE_ROW_MAX);
    expect(group.morePeople).toBe(3);
  });
});

describe("groupProgramme：展覽整個展期一組", () => {
  it("一組，日期是最早到最晚", () => {
    const rows = [
      feeling({ episodeId: "a", penName: "雨青", experiencedAt: "2026-10-06T07:00:00Z" }),
      feeling({ episodeId: "b", penName: "小魚", experiencedAt: "2026-09-20T07:00:00Z" }),
    ];
    const groups = groupProgramme(rows, "exhibition", NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].dateLabel).toBe("09.20 – 10.06");
    expect(groups[0].people.map((person) => person.penName)).toEqual(["雨青", "小魚"]);
  });

  it("沒有感受就沒有組", () => {
    expect(groupProgramme([], "exhibition", NOW)).toEqual([]);
  });
});
