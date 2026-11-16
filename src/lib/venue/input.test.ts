import { describe, expect, it } from "vitest";
import { liveInputFromManual, parseLiveJournalInput } from "./input";

// 2026-10-10 22:41 台北
const AT = new Date("2026-10-10T14:41:00Z");

describe("parseLiveJournalInput", () => {
  it("不是場外場域、或沒帶 liveName → null（走原本的作品流程）", () => {
    expect(parseLiveJournalInput({ venue: "cinema", liveName: "x" }, AT)).toEqual({ ok: true, value: null });
    expect(parseLiveJournalInput({ venue: "live" }, AT)).toEqual({ ok: true, value: null });
  });

  it("演出：名稱、場地、日期都帶", () => {
    const result = parseLiveJournalInput(
      { venue: "live", liveName: " 島嶼夜歌・草地音樂會 ", liveVenue: " 大佳河濱公園 草地舞台 ", liveDates: "10.09 – 10.10" },
      AT,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "live",
        name: "島嶼夜歌・草地音樂會",
        key: "島嶼夜歌草地音樂會",
        venue: "大佳河濱公園 草地舞台",
        dates: { start: "2026-10-09", end: "2026-10-10" },
      },
    });
  });

  it("展覽沒寫日期 → 用記一筆那天（邏輯日）當單日", () => {
    const lateNight = new Date("2026-10-10T17:30:00Z"); // 台北 10/11 01:30 → 邏輯日 10/10
    const result = parseLiveJournalInput({ venue: "exhibition", liveName: "光的抄寫", liveDates: "" }, lateNight);
    expect(result.ok && result.value?.dates).toEqual({ start: "2026-10-10", end: null });
    expect(result.ok && result.value?.kind).toBe("exhibition");
    expect(result.ok && result.value?.venue).toBeNull();
  });

  it("名稱空白或全是標點 → 錯誤", () => {
    expect(parseLiveJournalInput({ venue: "live", liveName: "  " }, AT).ok).toBe(false);
    expect(parseLiveJournalInput({ venue: "live", liveName: "！！" }, AT).ok).toBe(false);
  });

  it("型別不對、太長、日期看不懂 → 錯誤", () => {
    expect(parseLiveJournalInput({ venue: "live", liveName: 3 }, AT).ok).toBe(false);
    expect(parseLiveJournalInput({ venue: "live", liveName: "字".repeat(101) }, AT).ok).toBe(false);
    expect(parseLiveJournalInput({ venue: "live", liveName: "a", liveVenue: "字".repeat(101) }, AT).ok).toBe(false);
    expect(parseLiveJournalInput({ venue: "live", liveName: "a", liveDates: "下週" }, AT).ok).toBe(false);
    expect(parseLiveJournalInput({ venue: "live", liveName: "a", liveDates: 5 }, AT).ok).toBe(false);
  });
});

describe("liveInputFromManual：作品選擇器手動輸入的演出／展覽走同一套歸併（Dex 10/11 拍板）", () => {
  const now = new Date("2026-10-10T14:00:00+08:00");

  it("演出：名稱正規化成鍵，日期用手填的那天", () => {
    expect(liveInputFromManual({ kind: "live", title: "島嶼夜歌・草地音樂會", venue: "大佳河濱", eventDate: "2026-10-09" }, now)).toEqual({
      kind: "live",
      name: "島嶼夜歌・草地音樂會",
      key: "島嶼夜歌草地音樂會",
      venue: "大佳河濱",
      dates: { start: "2026-10-09", end: null },
    });
  });

  it("沒填日期時用今天（邏輯日）", () => {
    expect(liveInputFromManual({ kind: "exhibition", title: "光的抄寫" }, now)?.dates).toEqual({ start: "2026-10-10", end: null });
  });

  it("電影等其他類型、或名稱只有標點 → null（照舊新建）", () => {
    expect(liveInputFromManual({ kind: "movie", title: "海街日記" }, now)).toBeNull();
    expect(liveInputFromManual({ kind: "live", title: "！！" }, now)).toBeNull();
  });
});
