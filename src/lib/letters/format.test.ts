import { describe, expect, it } from "vitest";
import {
  inboxStatLine,
  letterDay,
  letterNote,
  letterTime,
  lettersTabLabel,
  publishedCountLabel,
  sentLine,
  stampDate,
} from "./format";

// 2026-10-10 09:12 台北 = 01:12 UTC（週六）
const MORNING = "2026-10-10T01:12:00Z";
// 2026-10-09 23:48 台北 = 15:48 UTC（週五）
const NIGHT = "2026-10-09T15:48:00Z";

describe("letter dates（台北時間）", () => {
  it("列表日期 MM.DD", () => {
    expect(letterDay(MORNING)).toBe("10.10");
    expect(letterDay("2026-10-09T16:30:00Z")).toBe("10.10");
  });

  it("單封時間：10.10 週六・上午 09:12", () => {
    expect(letterTime(MORNING)).toBe("10.10 週六・上午 09:12");
    expect(letterTime(NIGHT)).toBe("10.09 週五・晚上 23:48");
    expect(letterTime("2026-10-10T06:05:00Z")).toBe("10.10 週六・下午 14:05");
    expect(letterTime("2026-10-09T18:30:00Z")).toBe("10.10 週六・凌晨 02:30");
    expect(letterTime("2026-10-10T04:00:00Z")).toBe("10.10 週六・中午 12:00");
  });

  it("已刊登大章：MM.DD", () => {
    expect(stampDate(MORNING)).toBe("10.10");
    expect(stampDate("2026-03-05T04:00:00Z")).toBe("03.05");
  });

  it("壞日期不炸", () => {
    expect(letterDay("nope")).toBe("—");
    expect(letterTime("nope")).toBe("—");
    expect(stampDate("nope")).toBe("—");
  });
});

describe("inboxStatLine", () => {
  it("依總數與未讀數", () => {
    expect(inboxStatLine(3, 1)).toBe("3 封信，1 封還沒拆。");
    expect(inboxStatLine(3, 0)).toBe("3 封信，都讀過了。");
    expect(inboxStatLine(2, 2)).toBe("2 封信，都還沒拆。");
    expect(inboxStatLine(1, 1)).toBe("1 封信，還沒拆。");
    expect(inboxStatLine(1, 0)).toBe("1 封信，讀過了。");
    expect(inboxStatLine(12, 2)).toBe("12 封信，2 封還沒拆。");
  });
});

describe("letterNote（列表狀態小字）", () => {
  it("刊登／只放在這裡／未決定", () => {
    expect(letterNote("published", false)).toBe("在文章末尾");
    expect(letterNote("published", true)).toBe("你回覆了");
    expect(letterNote("kept", true)).toBe("只放在這裡");
    expect(letterNote("none", false)).toBeNull();
  });
});

describe("文案", () => {
  it("寄出後收成一行", () => {
    expect(sentLine(MORNING, "林小晴")).toBe("你在 10.10 寄了一封信給林小晴。");
  });

  it("讀者來函小標：N 封", () => {
    expect(publishedCountLabel(2)).toBe("作者選刊・2 封");
    expect(publishedCountLabel(11)).toBe("作者選刊・11 封");
  });

  it("來信分頁讀螢幕文字", () => {
    expect(lettersTabLabel(0)).toBe("來信");
    expect(lettersTabLabel(1)).toBe("來信，1 封未讀");
    expect(lettersTabLabel(3)).toBe("來信，3 封未讀");
  });
});
