import { describe, expect, it } from "vitest";
import {
  groupFeelings,
  layoutFeatureResonance,
  pickCast,
  rankFeatureQuotes,
  resonanceSource,
  sameShowNote,
  verticalQuoteText,
  type CastCandidate,
  type FeatureQuoteCandidate,
} from "./feature";

const quote = (
  author: string,
  text: string,
  count: number,
  publishedAt = "2026-10-05T10:00:00Z",
): FeatureQuoteCandidate => ({ author, text, count, publishedAt, episodeId: `ep-${author}` });

describe("rankFeatureQuotes：依共鳴排序，每位作者一句", () => {
  it("共鳴多的在前；同數依發表時間早 → 晚", () => {
    const ranked = rankFeatureQuotes(
      [
        quote("阿哲", "梅酒要等一年，原來在乎也是。", 3, "2026-10-09T10:00:00Z"),
        quote("林小晴", "有些人一直都在，只是我很久沒有好好看她。", 12),
        quote("Kai", "我好想有人叫我回家吃飯。", 3, "2026-10-08T10:00:00Z"),
      ],
      [],
    );
    expect(ranked.map((item) => item.author)).toEqual(["林小晴", "Kai", "阿哲"]);
  });

  it("同一位作者只取共鳴最多的一句", () => {
    const ranked = rankFeatureQuotes(
      [quote("阿哲", "第一句。", 2), quote("阿哲", "第二句。", 5), quote("Kai", "別的。", 1)],
      [],
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({ author: "阿哲", text: "第二句。", count: 5 });
  });

  it("沒有人留記號的作者，用文章引言補位（排在有共鳴的後面）", () => {
    const ranked = rankFeatureQuotes(
      [quote("阿哲", "梅酒要等一年。", 1)],
      [quote("阿布", "有些話不說。", 0, "2026-09-21T10:00:00Z"), quote("阿哲", "不會重複。", 0)],
    );
    expect(ranked.map((item) => [item.author, item.count])).toEqual([
      ["阿哲", 1],
      ["阿布", 0],
    ]);
  });

  it("最多三句", () => {
    const many = ["甲", "乙", "丙", "丁"].map((name, index) => quote(name, `第${index}句。`, 4 - index));
    expect(rankFeatureQuotes(many, [])).toHaveLength(3);
  });
});

describe("resonance.layout", () => {
  it("零句 → 稿紙空行", () => {
    expect(layoutFeatureResonance([])).toEqual({ variant: "empty" });
  });
  it("一句 → 橫排並留「等第二句」", () => {
    const only = rankFeatureQuotes([], [quote("阿布", "有些話不說。", 0)]);
    expect(layoutFeatureResonance(only)).toEqual({ variant: "single", quote: only[0] });
  });
  it("兩句以上 → 直排", () => {
    const two = rankFeatureQuotes([quote("甲", "一。", 2), quote("乙", "二。", 1)], []);
    expect(layoutFeatureResonance(two)).toEqual({ variant: "vertical", quotes: two });
  });
});

describe("verticalQuoteText：直排一格放得下 22 字", () => {
  it("短句原樣", () => {
    expect(verticalQuoteText("「我好想有人叫我回家吃飯。」")).toBe("我好想有人叫我回家吃飯。");
  });
  it("長段取第一個放得下的句子", () => {
    expect(
      verticalQuoteText("這部片沒有教我什麼道理，我只是一直坐著看完了它最後的那一場戲。它只是讓我想起很多事。"),
    ).toBe("它只是讓我想起很多事。");
  });
  it("沒有放得下的句子 → 截成 21 字加刪節號", () => {
    const long = "一".repeat(40);
    expect(verticalQuoteText(long)).toBe(`${"一".repeat(21)}⋯`);
  });
});

describe("resonance.source：「阿哲、Kai 和另外九人也這樣想」", () => {
  it("點名最多兩位，其餘算另外 N 人", () => {
    expect(resonanceSource(11, ["阿哲", "Kai", "小魚"])).toEqual({ names: ["阿哲", "Kai"], others: 9 });
  });
  it("只有點得出名字的人", () => {
    expect(resonanceSource(2, ["阿哲", "Kai"])).toEqual({ names: ["阿哲", "Kai"], others: 0 });
  });
  it("沒有能點名的人 → 全部算人數", () => {
    expect(resonanceSource(3, [])).toEqual({ names: [], others: 3 });
  });
  it("沒有共鳴 → null", () => {
    expect(resonanceSource(0, ["阿哲"])).toBeNull();
  });
  it("名字比人數多（資料不一致）不超過人數", () => {
    expect(resonanceSource(1, ["阿哲", "Kai"])).toEqual({ names: ["阿哲"], others: 0 });
  });
});

const cast = (userId: string, penName: string | null, saidAt: string): CastCandidate => ({
  userId,
  penName,
  saidAt,
  shareSlug: `s-${userId}-${saidAt}`,
  pullQuote: null,
});

describe("pickCast：同場的人", () => {
  const since = new Date("2026-10-04T16:00:00Z");
  const rows = [
    cast("u1", "阿哲", "2026-10-09T10:00:00Z"),
    cast("u2", "Kai", "2026-10-09T08:00:00Z"),
    cast("u1", "阿哲", "2026-10-06T10:00:00Z"),
    cast("u3", null, "2026-10-08T10:00:00Z"),
    cast("u4", "老陳", "2026-10-01T10:00:00Z"),
    cast("author", "林小晴", "2026-10-08T10:00:00Z"),
  ];

  it("窗內、有筆名、每人一次（取最新）、依說的時間新 → 舊、排除指定的人", () => {
    const picked = pickCast(rows, { since, exclude: "author", limit: 8 });
    expect(picked.map((item) => [item.penName, item.saidAt])).toEqual([
      ["阿哲", "2026-10-09T10:00:00Z"],
      ["Kai", "2026-10-09T08:00:00Z"],
    ]);
  });

  it("上限", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      cast(`u${index}`, `人${index}`, `2026-10-0${(index % 5) + 5}T10:00:00Z`),
    );
    expect(pickCast(many, { since, limit: 8 })).toHaveLength(8);
  });
});

describe("group.subhead：本週／更早", () => {
  const now = new Date("2026-10-10T13:00:00Z");
  const weekStart = new Date("2026-10-04T16:00:00Z");
  const feeling = (id: string, publishedAt: string) => ({ id, publishedAt });

  it("依本週起點分兩段，空的段不出現", () => {
    const groups = groupFeelings(
      [
        feeling("a", "2026-10-10T05:00:00Z"),
        feeling("b", "2026-10-05T05:00:00Z"),
        feeling("c", "2026-10-03T05:00:00Z"),
        feeling("d", "2026-08-16T05:00:00Z"),
      ],
      weekStart,
      now,
    );
    expect(groups).toEqual([
      { key: "week", label: "本週", count: "2 段", range: "10.05 – 10.10", items: [feeling("a", "2026-10-10T05:00:00Z"), feeling("b", "2026-10-05T05:00:00Z")] },
      { key: "earlier", label: "更早", count: "2 段", range: "08.16 – 10.03", items: [feeling("c", "2026-10-03T05:00:00Z"), feeling("d", "2026-08-16T05:00:00Z")] },
    ]);
  });

  it("沒有本週 → 只有更早；單日只寫一個日期", () => {
    const groups = groupFeelings([feeling("a", "2026-09-21T05:00:00Z")], weekStart, now);
    expect(groups).toEqual([
      { key: "earlier", label: "更早", count: "1 段", range: "09.21", items: [feeling("a", "2026-09-21T05:00:00Z")] },
    ]);
  });

  it("零感受 → 沒有分段", () => {
    expect(groupFeelings([], weekStart, now)).toEqual([]);
  });
});

describe("sameShowNote", () => {
  it("依作品類型", () => {
    expect(sameShowNote("movie")).toBe("同一週，同一部電影。點印章，讀他們的專欄。");
    expect(sameShowNote("podcast_episode")).toBe("同一週，同一集節目。點印章，讀他們的專欄。");
    expect(sameShowNote("unknown")).toBe("同一週，同一部作品。點印章，讀他們的專欄。");
  });
});
