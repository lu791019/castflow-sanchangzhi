import { describe, expect, it } from "vitest";
import { buildManualInput } from "@/components/work-picker/manual-form";
import { isValidEventDate, parseCreateWorkInput } from "./input";
import { manualWorkInsert } from "./work-rows";

describe("manual：演出／展覽", () => {
  it("live / exhibition 是合法 kind，帶場地與日期", () => {
    expect(
      parseCreateWorkInput({
        source: "manual",
        kind: "live",
        title: " 大港開唱 2026 ",
        venue: "  高雄  駁二 ",
        eventDate: "2026-03-28",
      }),
    ).toEqual({
      ok: true,
      value: { source: "manual", kind: "live", title: "大港開唱 2026", venue: "高雄 駁二", eventDate: "2026-03-28" },
    });
    expect(parseCreateWorkInput({ source: "manual", kind: "exhibition", title: "常玉展" })).toEqual({
      ok: true,
      value: { source: "manual", kind: "exhibition", title: "常玉展", venue: null, eventDate: null },
    });
  });

  it("日期格式錯、不存在的日期、場地過長 → 錯誤", () => {
    expect(parseCreateWorkInput({ source: "manual", kind: "live", title: "x", eventDate: "2026/03/28" }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "manual", kind: "live", title: "x", eventDate: "2026-02-30" }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "manual", kind: "live", title: "x", venue: "場".repeat(81) }).ok).toBe(false);
  });

  it("非現場類帶了場地日期也忽略（形狀不變）", () => {
    expect(
      parseCreateWorkInput({ source: "manual", kind: "movie", title: "海角七號", venue: "x", eventDate: "bad" }),
    ).toEqual({ ok: true, value: { source: "manual", kind: "movie", title: "海角七號" } });
  });

  it("isValidEventDate", () => {
    expect(isValidEventDate("2024-02-29")).toBe(true);
    expect(isValidEventDate("2023-02-29")).toBe(false);
    expect(isValidEventDate("1700-01-01")).toBe(false);
    expect(isValidEventDate("2026-13-01")).toBe(false);
  });

  it("manualWorkInsert：現場類寫 venue / event_date，其他類型不帶這兩欄", () => {
    const live = manualWorkInsert({ kind: "live", title: "大港開唱", venue: "駁二", eventDate: "2026-03-28" }, 1);
    expect(live).toMatchObject({ kind: "live", venue: "駁二", event_date: "2026-03-28" });
    expect(live.slug).toMatch(/^manual-live-[0-9a-f]{8}-1$/);
    const movie = manualWorkInsert({ kind: "movie", title: "海角七號", venue: "x" }, 1);
    expect("venue" in movie).toBe(false);
    expect("event_date" in movie).toBe(false);
  });

  it("表單送出：只有演出／展覽帶場地日期，空字串轉 null", () => {
    expect(buildManualInput("live", " 大港開唱 ", " 駁二 ", "2026-03-28")).toEqual({
      kind: "live",
      title: "大港開唱",
      venue: "駁二",
      eventDate: "2026-03-28",
    });
    expect(buildManualInput("exhibition", "常玉展", "", "")).toEqual({
      kind: "exhibition",
      title: "常玉展",
      venue: null,
      eventDate: null,
    });
    expect(buildManualInput("movie", "海角七號", "駁二", "2026-03-28")).toEqual({ kind: "movie", title: "海角七號" });
  });
});
