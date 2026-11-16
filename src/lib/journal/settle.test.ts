import { describe, expect, it } from "vitest";
import {
  buildSettleCopy,
  buildSettleMorningCopy,
  estimateSettleAt,
  isSettleNight,
  settleDecision,
  SETTLE_TIMING,
} from "./settle";
import { fromTaipei, HOUR_MS, MINUTE_MS } from "./time";

const at = (d: Date) => ({ experienced_at: d.toISOString(), venue: "cinema" as const });

describe("estimateSettleAt", () => {
  it("電影：場次＋片長（works 有 runtime 就用）＋15 分", () => {
    const start = fromTaipei(2026, 10, 14, 19, 30);
    const result = estimateSettleAt(at(start), { kind: "movie", runtime_minutes: 100 });
    expect(result?.toISOString()).toBe(fromTaipei(2026, 10, 14, 21, 25).toISOString());
  });

  it("電影：沒有片長預設 130 分", () => {
    const start = fromTaipei(2026, 10, 14, 19, 0);
    expect(estimateSettleAt(at(start), { kind: "movie" })?.toISOString()).toBe(
      fromTaipei(2026, 10, 14, 21, 25).toISOString(),
    );
    expect(estimateSettleAt(at(start), { kind: "movie", runtime_minutes: null })?.toISOString()).toBe(
      fromTaipei(2026, 10, 14, 21, 25).toISOString(),
    );
  });

  it("電影：片長不合理（0、負數、非數字）也退回預設", () => {
    const start = fromTaipei(2026, 10, 14, 19, 0);
    const expected = fromTaipei(2026, 10, 14, 21, 25).toISOString();
    expect(estimateSettleAt(at(start), { kind: "movie", runtime_minutes: 0 })?.toISOString()).toBe(expected);
    expect(estimateSettleAt(at(start), { kind: "movie", runtime_minutes: -5 })?.toISOString()).toBe(expected);
  });

  it("電影跨午夜：23:10 開演 → 隔天 01:35（台北）", () => {
    const start = fromTaipei(2026, 10, 31, 23, 10);
    expect(estimateSettleAt(at(start), { kind: "movie" })?.toISOString()).toBe(
      fromTaipei(2026, 11, 1, 1, 35).toISOString(),
    );
  });

  it("演出：場次＋150 分；展覽：場次＋90 分", () => {
    const start = fromTaipei(2026, 10, 14, 19, 30);
    expect(estimateSettleAt(at(start), { kind: "live" })?.toISOString()).toBe(fromTaipei(2026, 10, 14, 22, 0).toISOString());
    expect(estimateSettleAt(at(start), { kind: "exhibition" })?.toISOString()).toBe(
      fromTaipei(2026, 10, 14, 21, 0).toISOString(),
    );
  });

  it("影集、Podcast 不提醒", () => {
    const start = fromTaipei(2026, 10, 14, 20);
    expect(estimateSettleAt(at(start), { kind: "series" })).toBeNull();
    expect(estimateSettleAt(at(start), { kind: "podcast_episode" })).toBeNull();
  });

  it("只記名稱：看場域（電影院＝電影、演出、展覽），在家／通勤不提醒", () => {
    const start = fromTaipei(2026, 10, 14, 19, 0);
    const of = (venue: "cinema" | "live" | "exhibition" | "home" | "commute" | "other") =>
      estimateSettleAt({ experienced_at: start.toISOString(), venue }, null)?.toISOString() ?? null;
    expect(of("cinema")).toBe(fromTaipei(2026, 10, 14, 21, 25).toISOString());
    expect(of("live")).toBe(fromTaipei(2026, 10, 14, 21, 30).toISOString());
    expect(of("exhibition")).toBe(fromTaipei(2026, 10, 14, 20, 30).toISOString());
    expect(of("home")).toBeNull();
    expect(of("commute")).toBeNull();
    expect(of("other")).toBeNull();
  });

  it("時間無效回 null", () => {
    expect(estimateSettleAt({ experienced_at: "not-a-date", venue: "cinema" }, { kind: "movie" })).toBeNull();
  });

  it("常數集中可調", () => {
    expect(SETTLE_TIMING.movieDefaultRuntimeMin).toBe(130);
    expect(SETTLE_TIMING.movieBufferMin).toBe(15);
    expect(SETTLE_TIMING.liveMin).toBe(150);
    expect(SETTLE_TIMING.exhibitionMin).toBe(90);
    expect(SETTLE_TIMING.windowMs).toBe(2 * HOUR_MS);
  });
});

describe("isSettleNight（23:30–08:00 台北）", () => {
  it("邊界", () => {
    expect(isSettleNight(fromTaipei(2026, 10, 14, 23, 29))).toBe(false);
    expect(isSettleNight(fromTaipei(2026, 10, 14, 23, 30))).toBe(true);
    expect(isSettleNight(fromTaipei(2026, 10, 15, 2, 0))).toBe(true);
    expect(isSettleNight(fromTaipei(2026, 10, 15, 7, 59))).toBe(true);
    expect(isSettleNight(fromTaipei(2026, 10, 15, 8, 0))).toBe(false);
    expect(isSettleNight(fromTaipei(2026, 10, 15, 15, 0))).toBe(false);
  });
});

describe("settleDecision", () => {
  const settle = fromTaipei(2026, 10, 14, 21, 0);

  it("還沒散場：wait", () => {
    expect(settleDecision(settle, new Date(settle.getTime() - MINUTE_MS))).toEqual({ type: "wait" });
  });

  it("散場後 2 小時內：push（含兩端）", () => {
    expect(settleDecision(settle, settle)).toEqual({ type: "push" });
    expect(settleDecision(settle, new Date(settle.getTime() + 2 * HOUR_MS))).toEqual({ type: "push" });
  });

  it("超過 2 小時、白天場：expired（不補）", () => {
    const afternoon = fromTaipei(2026, 10, 14, 15, 0);
    expect(settleDecision(afternoon, new Date(afternoon.getTime() + 2 * HOUR_MS + MINUTE_MS))).toEqual({ type: "expired" });
    // 隔天早上也不補「昨晚」
    expect(settleDecision(afternoon, fromTaipei(2026, 10, 15, 9, 30))).toEqual({ type: "expired" });
  });

  it("深夜散場（23:30 之後）：不推，等隔天 09:00 收件匣", () => {
    const late = fromTaipei(2026, 10, 14, 23, 45);
    expect(settleDecision(late, fromTaipei(2026, 10, 14, 23, 50))).toEqual({ type: "wait" });
    expect(settleDecision(late, fromTaipei(2026, 10, 15, 8, 59))).toEqual({ type: "wait" });
    expect(settleDecision(late, fromTaipei(2026, 10, 15, 9, 0))).toEqual({
      type: "morning",
      at: fromTaipei(2026, 10, 15, 9, 0),
    });
    expect(settleDecision(late, fromTaipei(2026, 10, 15, 20, 0))).toEqual({
      type: "morning",
      at: fromTaipei(2026, 10, 15, 9, 0),
    });
    expect(settleDecision(late, fromTaipei(2026, 10, 15, 21, 1))).toEqual({ type: "expired" });
  });

  it("跨午夜散場（01:35）：當天 09:00", () => {
    const afterMidnight = fromTaipei(2026, 11, 1, 1, 35);
    expect(settleDecision(afterMidnight, fromTaipei(2026, 11, 1, 2, 0))).toEqual({ type: "wait" });
    expect(settleDecision(afterMidnight, fromTaipei(2026, 11, 1, 9, 5))).toEqual({
      type: "morning",
      at: fromTaipei(2026, 11, 1, 9, 0),
    });
  });

  it("22:30 散場：23:30 前照推；worker 拖到 23:30 之後就改隔天早上", () => {
    const s = fromTaipei(2026, 10, 14, 22, 30);
    expect(settleDecision(s, fromTaipei(2026, 10, 14, 23, 29))).toEqual({ type: "push" });
    expect(settleDecision(s, fromTaipei(2026, 10, 14, 23, 40))).toEqual({ type: "wait" });
    expect(settleDecision(s, fromTaipei(2026, 10, 15, 9, 10))).toEqual({
      type: "morning",
      at: fromTaipei(2026, 10, 15, 9, 0),
    });
  });
});

describe("散場提醒文案", () => {
  it("電影：散場了？／《作品》剛結束。說一段，或打幾句。", () => {
    expect(buildSettleCopy({ workTitle: "海街日記", kind: "movie", venue: "cinema" })).toEqual({
      title: "散場了？",
      body: "《海街日記》剛結束。說一段，或打幾句。",
    });
  });

  it("演出不加書名號；展覽改「逛完了？」", () => {
    expect(buildSettleCopy({ workTitle: "落日飛車", kind: "live", venue: "live" })).toEqual({
      title: "散場了？",
      body: "落日飛車剛結束。說一段，或打幾句。",
    });
    expect(buildSettleCopy({ workTitle: "莫內展", kind: "exhibition", venue: "exhibition" })).toEqual({
      title: "逛完了？",
      body: "《莫內展》逛完了。說一段，或打幾句。",
    });
  });

  it("沒有名稱用「那一場」", () => {
    expect(buildSettleCopy({ workTitle: "  ", kind: null, venue: "cinema" }).body).toBe("那一場剛結束。說一段，或打幾句。");
  });

  it("隔天早上：昨晚的《作品》，還記得什麼嗎？", () => {
    expect(buildSettleMorningCopy({ workTitle: "海街日記", kind: "movie", venue: "cinema" })).toEqual({
      title: "昨晚的《海街日記》，還記得什麼嗎？",
      body: "說一段，或打幾句。",
    });
    expect(buildSettleMorningCopy({ workTitle: "落日飛車", kind: "live", venue: "live" }).title).toBe(
      "昨晚的落日飛車，還記得什麼嗎？",
    );
  });
});
