import { describe, expect, it } from "vitest";
import { formatJournalByline } from "./byline";
import { fromTaipei } from "./time";

const at = (month: number, day: number, hour: number, minute = 0) =>
  fromTaipei(2026, month, day, hour, minute);

/** 設計稿「P1 元件特寫 04 新署名」：{日期}{時段或場域}{看完／聽完／逛完}・{時間差}{說的／寫的} */
describe("formatJournalByline", () => {
  it("設計例 1：在家晚上看完、隔天說", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 7, 21), venue: "home", saidAt: at(10, 8, 12) }),
    ).toBe("10.07 晚上看完・隔天說的");
  });

  it("設計例 2：1 小時內 → 散場後 18 分鐘（仍帶日期前綴；有場域優先寫場域）", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 7, 21), venue: "cinema", saidAt: at(10, 7, 21, 18) }),
    ).toBe("10.07 在電影院看完・散場後 18 分鐘說的");
  });

  it("設計例 3：在電影院看完、兩天後說", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 5, 20), venue: "cinema", saidAt: at(10, 7, 9) }),
    ).toBe("10.05 在電影院看完・2 天後說的");
  });

  it("設計例 4：通勤時聽完・當天晚上寫的", () => {
    expect(
      formatJournalByline({
        experiencedAt: at(10, 6, 8),
        venue: "commute",
        saidAt: at(10, 6, 21),
        verb: "聽完",
        typed: true,
      }),
    ).toBe("10.06 通勤時聽完・當天晚上寫的");
  });

  it("同一天 ≥1 小時 → 當天＋說的時段", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 7, 14), venue: "home", saidAt: at(10, 7, 17, 40) }),
    ).toBe("10.07 下午看完・當天下午說的");
  });

  it("半夜跨日但仍同一邏輯日（4 點換日）→ 當天深夜", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 7, 21), venue: "home", saidAt: at(10, 8, 1, 30) }),
    ).toBe("10.07 晚上看完・當天深夜說的");
  });

  it("凌晨看完的日期歸前一晚", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 8, 1), venue: "home", saidAt: at(10, 8, 20) }),
    ).toBe("10.07 深夜看完・隔天說的");
  });

  it.each([
    [3, "3 天後"],
    [6, "6 天後"],
    [7, "一週後"],
    [13, "一週後"],
    [14, "半個月後"],
    [29, "半個月後"],
    [30, "1 個月後"],
    [65, "2 個月後"],
  ])("隔 %i 天 → %s", (days, phrase) => {
    const experiencedAt = at(1, 1, 20);
    const saidAt = new Date(experiencedAt.getTime() + days * 24 * 60 * 60 * 1000);
    expect(formatJournalByline({ experiencedAt, venue: "home", saidAt })).toBe(
      `01.01 晚上看完・${phrase}說的`,
    );
  });

  it("音樂祭預設「聽完」、在現場", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 4, 21), venue: "live", saidAt: at(10, 5, 21) }),
    ).toBe("10.04 在現場聽完・隔天說的");
  });

  it("展覽「逛完」、其他與 null 寫時段", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 3, 15), venue: "exhibition", saidAt: at(10, 4, 10) }),
    ).toBe("10.03 在展場逛完・隔天說的");
    expect(
      formatJournalByline({ experiencedAt: at(10, 3, 9), venue: null, saidAt: at(10, 4, 10) }),
    ).toBe("10.03 早上看完・隔天說的");
  });

  it("非劇場場域 <1h 寫「看完後」", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 7, 21), venue: "commute", saidAt: at(10, 7, 21, 5), verb: "聽完" }),
    ).toBe("10.07 通勤時聽完・聽完後 5 分鐘說的");
  });

  it("不足一分鐘或時間倒置 → 至少 1 分鐘", () => {
    expect(
      formatJournalByline({ experiencedAt: at(10, 7, 21), venue: "cinema", saidAt: at(10, 7, 20, 50) }),
    ).toBe("10.07 在電影院看完・散場後 1 分鐘說的");
  });

  it("接受 ISO 字串", () => {
    expect(
      formatJournalByline({
        experiencedAt: "2026-10-07T13:00:00Z",
        venue: "home",
        saidAt: "2026-10-08T04:00:00Z",
      }),
    ).toBe("10.07 晚上看完・隔天說的");
  });

  it("無效時間丟錯", () => {
    expect(() =>
      formatJournalByline({ experiencedAt: "nope", venue: "home", saidAt: at(10, 7, 21) }),
    ).toThrow("experiencedAt");
  });
});
