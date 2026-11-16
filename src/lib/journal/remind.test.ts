import { describe, expect, it } from "vitest";
import { buildPlanCopy, buildReminderCopy, computeRemindAt, planRemindAt, reminderQuestion, timingCopy } from "./remind";
import { fromTaipei } from "./time";

describe("computeRemindAt", () => {
  it("next_noon：晚上看完 → 隔天 12:00 台北", () => {
    const result = computeRemindAt(fromTaipei(2026, 10, 7, 21), "next_noon");
    expect(result?.toISOString()).toBe(fromTaipei(2026, 10, 8, 12).toISOString());
    expect(result?.toISOString()).toBe("2026-10-08T04:00:00.000Z");
  });

  it("next_noon：上午看完也是隔天中午（不是當天）", () => {
    const result = computeRemindAt(fromTaipei(2026, 10, 7, 9), "next_noon");
    expect(result?.toISOString()).toBe(fromTaipei(2026, 10, 8, 12).toISOString());
  });

  it("next_noon：凌晨 1 點看完算前一晚 → 當天中午", () => {
    const result = computeRemindAt(fromTaipei(2026, 10, 8, 1), "next_noon");
    expect(result?.toISOString()).toBe(fromTaipei(2026, 10, 8, 12).toISOString());
  });

  it("next_noon：凌晨 4 點後算新的一天", () => {
    const result = computeRemindAt(fromTaipei(2026, 10, 8, 5), "next_noon");
    expect(result?.toISOString()).toBe(fromTaipei(2026, 10, 9, 12).toISOString());
  });

  it("next_noon：跨月、跨年", () => {
    expect(computeRemindAt(fromTaipei(2026, 10, 31, 22), "next_noon")?.toISOString()).toBe(
      fromTaipei(2026, 11, 1, 12).toISOString(),
    );
    expect(computeRemindAt(fromTaipei(2026, 12, 31, 22), "next_noon")?.toISOString()).toBe(
      "2027-01-01T04:00:00.000Z",
    );
  });

  it("half_day：+12 小時（落在白天）", () => {
    const experienced = fromTaipei(2026, 10, 7, 8, 30);
    expect(computeRemindAt(experienced, "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 7, 20, 30).toISOString(),
    );
  });

  it("half_day：落在 23:00–9:00 改到早上 9 點", () => {
    expect(computeRemindAt(fromTaipei(2026, 10, 7, 13, 30), "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 8, 9).toISOString(),
    );
    expect(computeRemindAt(fromTaipei(2026, 10, 7, 11, 30), "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 8, 9).toISOString(),
    );
  });

  it("half_day：落在凌晨（同一曆日）也改當天 9 點", () => {
    expect(computeRemindAt(fromTaipei(2026, 10, 7, 14), "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 8, 9).toISOString(),
    );
    expect(computeRemindAt(fromTaipei(2026, 10, 7, 20), "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 8, 9).toISOString(),
    );
  });

  it("half_day：剛好 9:00 或 22:59 不動", () => {
    expect(computeRemindAt(fromTaipei(2026, 10, 7, 21), "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 8, 9).toISOString(),
    );
    expect(computeRemindAt(fromTaipei(2026, 10, 7, 10, 59), "half_day")?.toISOString()).toBe(
      fromTaipei(2026, 10, 7, 22, 59).toISOString(),
    );
  });

  it("off：不提醒", () => {
    expect(computeRemindAt(new Date(), "off")).toBeNull();
  });

  it("無效時間丟錯", () => {
    expect(() => computeRemindAt(new Date("x"), "next_noon")).toThrow();
  });
});

describe("buildReminderCopy（設計稿「推播 · 文案依類型」）", () => {
  const askedAt = fromTaipei(2026, 10, 8, 12);

  it("電影・影集：昨晚的《海街日記》", () => {
    expect(
      buildReminderCopy({
        workTitle: "海街日記",
        kind: "movie",
        experiencedAt: fromTaipei(2026, 10, 7, 21),
        venue: "cinema",
        askedAt,
      }),
    ).toEqual({ title: "昨晚的《海街日記》", body: "看完 1 天了，現在想說說嗎？說一分鐘就好。" });
  });

  it("Podcast：早上通勤聽的《慢慢說》", () => {
    expect(
      buildReminderCopy({
        workTitle: "慢慢說",
        kind: "podcast_episode",
        experiencedAt: fromTaipei(2026, 10, 8, 8, 35),
        venue: "commute",
        askedAt,
      }),
    ).toEqual({ title: "早上通勤聽的《慢慢說》", body: "那一集還在你腦子裡嗎？想到什麼就說什麼。" });
  });

  it("演出：週六的草地音樂會（不加書名號）", () => {
    // 10.03 週六晚上 → 10.05 中午問：隔兩天
    expect(
      buildReminderCopy({
        workTitle: "草地音樂會",
        kind: "live",
        experiencedAt: fromTaipei(2026, 10, 3, 19),
        venue: "live",
        askedAt: fromTaipei(2026, 10, 5, 12),
      }),
    ).toEqual({ title: "週六的草地音樂會", body: "隔了 2 天，最記得的是哪一首？" });
  });

  it("演出隔一天：隔了一天", () => {
    expect(
      buildReminderCopy({
        workTitle: "草地音樂會",
        kind: null,
        experiencedAt: fromTaipei(2026, 10, 7, 19),
        venue: "live",
        askedAt,
      }).body,
    ).toBe("隔了 1 天，最記得的是哪一首？");
  });

  it("展覽：週一看的《光的抄寫》", () => {
    expect(
      buildReminderCopy({
        workTitle: "光的抄寫",
        kind: "exhibition",
        experiencedAt: fromTaipei(2026, 10, 5, 15),
        venue: "exhibition",
        askedAt,
      }),
    ).toEqual({ title: "週一看的《光的抄寫》", body: "有沒有哪一張，現在還想得起來？" });
  });

  it("半天後提醒：看完半天了", () => {
    expect(
      buildReminderCopy({
        workTitle: "海街日記",
        kind: "movie",
        experiencedAt: fromTaipei(2026, 10, 8, 9),
        venue: "home",
        askedAt: fromTaipei(2026, 10, 8, 21),
      }),
    ).toEqual({ title: "早上的《海街日記》", body: "看完半天了，現在想說說嗎？說一分鐘就好。" });
  });

  it("空名稱有後備；不用驚嘆號", () => {
    const copy = buildReminderCopy({
      workTitle: "  ",
      kind: null,
      experiencedAt: fromTaipei(2026, 10, 7, 21),
      venue: "other",
      askedAt,
    });
    expect(copy.title).toBe("昨晚的《那部作品》");
    expect(`${copy.title}${copy.body}`).not.toMatch(/[!！]/);
  });
});

describe("reminderQuestion（收件匣標題後的一句提問）", () => {
  it.each([
    ["movie", "cinema", "現在想說說嗎？"],
    ["podcast_episode", "commute", "那一集還在你腦子裡嗎？"],
    ["exhibition", "exhibition", "有沒有哪一張，現在還想得起來？"],
  ] as const)("%s → %s", (kind, venue, expected) => {
    expect(
      reminderQuestion({ kind, venue, experiencedAt: fromTaipei(2026, 10, 7, 21), askedAt: fromTaipei(2026, 10, 8, 12) }),
    ).toBe(expected);
  });

  it("演出：隔了幾天，最記得的是哪一首？", () => {
    expect(
      reminderQuestion({
        kind: "live",
        venue: "live",
        experiencedAt: fromTaipei(2026, 10, 4, 20),
        askedAt: fromTaipei(2026, 10, 9, 12),
      }),
    ).toBe("隔了 5 天，最記得的是哪一首？");
  });
});

describe("timingCopy", () => {
  it("預設隔天中午（設計稿文案）", () => {
    expect(timingCopy("next_noon")).toEqual({
      hint: "明天中午會問你想不想說說。可以在設定裡改。",
      toast: "明天中午會問你。",
    });
  });

  it("半天後、不提醒", () => {
    expect(timingCopy("half_day").toast).toBe("半天後會問你。");
    expect(timingCopy("off").hint).toContain("不會提醒你");
  });
});

describe("排行程：當天提醒時間與文案", () => {
  it("當天早上 9 點（台北）；場次比 9 點早就提前一小時", () => {
    expect(planRemindAt(fromTaipei(2026, 10, 18, 19, 30))).toEqual(fromTaipei(2026, 10, 18, 9));
    expect(planRemindAt(fromTaipei(2026, 10, 18, 8, 0))).toEqual(fromTaipei(2026, 10, 18, 7));
  });

  it("文案依類型", () => {
    expect(buildPlanCopy({ workTitle: "海街日記", kind: "movie", venue: "cinema" })).toEqual({ title: "今天的《海街日記》", body: "散場之後，回來說一句就好。" });
    expect(buildPlanCopy({ workTitle: "島嶼夜歌", kind: "live", venue: "live" }).title).toBe("今天的島嶼夜歌");
    expect(buildPlanCopy({ workTitle: "股癌", kind: "podcast_episode", venue: "commute" }).title).toBe("今天要聽的《股癌》");
  });
});
