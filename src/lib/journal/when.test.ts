import { describe, expect, it } from "vitest";
import { fromTaipei } from "./time";
import { isPlannedAt, parseTaipeiLocal, resolveWhen, toTaipeiLocalInput } from "./when";

const NOW = fromTaipei(2026, 10, 9, 23, 34);

describe("resolveWhen（記一筆「什麼時候」）", () => {
  it("剛剛 → 現在；章上日期＋時刻", () => {
    expect(resolveWhen("now", NOW)).toEqual({ at: NOW, stampDate: "10.09", stampTime: "23:34" });
  });

  it("今天稍早 → 3 小時前；章上寫「稍早」", () => {
    expect(resolveWhen("earlier", NOW)).toEqual({
      at: fromTaipei(2026, 10, 9, 20, 34),
      stampDate: "10.09",
      stampTime: "稍早",
    });
  });

  it("今天稍早不越過今天的起點（凌晨 4 點）", () => {
    const early = fromTaipei(2026, 10, 9, 5);
    expect(resolveWhen("earlier", early).at).toEqual(fromTaipei(2026, 10, 9, 4));
  });

  it("昨天 → 昨晚 21:00；章上寫「晚上」", () => {
    expect(resolveWhen("yesterday", NOW)).toEqual({
      at: fromTaipei(2026, 10, 8, 21),
      stampDate: "10.08",
      stampTime: "晚上",
    });
  });

  it("凌晨 1 點按「昨天」→ 前一個邏輯日的晚上", () => {
    expect(resolveWhen("yesterday", fromTaipei(2026, 10, 10, 1)).at).toEqual(fromTaipei(2026, 10, 8, 21));
  });

  it("選日期時間：合法值", () => {
    expect(resolveWhen("custom", NOW, "2026-10-05T14:00")).toEqual({
      at: fromTaipei(2026, 10, 5, 14),
      stampDate: "10.05",
      stampTime: "14:00",
    });
  });

  it("選日期時間：未選、格式錯、超過一年 → 尚未完成", () => {
    const pending = { at: null, stampDate: "──", stampTime: "請選擇" };
    expect(resolveWhen("custom", NOW)).toEqual(pending);
    expect(resolveWhen("custom", NOW, "nope")).toEqual(pending);
    expect(resolveWhen("custom", NOW, "2027-10-10T09:00")).toEqual(pending);
  });

  it("選未來 → 計畫（排行程）：章上標「計畫」；10 分鐘內不算", () => {
    const planned = resolveWhen("custom", NOW, "2026-10-10T09:00");
    expect(planned.at).toEqual(fromTaipei(2026, 10, 10, 9));
    expect(planned.stampTime).toBe("09:00 計畫");
    expect(isPlannedAt(fromTaipei(2026, 10, 10, 9), NOW)).toBe(true);
    expect(isPlannedAt(new Date(NOW.getTime() + 5 * 60 * 1000), NOW)).toBe(false);
  });
});

describe("台北 datetime-local 轉換", () => {
  it("往返一致", () => {
    expect(toTaipeiLocalInput(NOW)).toBe("2026-10-09T23:34");
    expect(parseTaipeiLocal("2026-10-09T23:34")).toEqual(NOW);
  });

  it("不合法回 null", () => {
    expect(parseTaipeiLocal("2026-13-01T00:00")).toBeNull();
    expect(parseTaipeiLocal("")).toBeNull();
  });
});
