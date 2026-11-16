import { describe, expect, it } from "vitest";
import { deriveSayTitle, formatClock, minutesSinceLabel } from "./stage";

describe("deriveSayTitle", () => {
  it("有作品卡時用「剛看完《作品》」", () => {
    expect(deriveSayTitle("隨便說了一些話。", "海街日記")).toBe(
      "剛看完《海街日記》",
    );
  });

  it("沒有作品時取首句並截 30 字", () => {
    expect(deriveSayTitle("燈亮的時候我還坐著。後面不算。", null)).toBe(
      "燈亮的時候我還坐著。",
    );
    const long = "這一句非常長".repeat(10);
    expect(deriveSayTitle(long, null)).toHaveLength(30);
  });

  it("空輸入退回預設標題", () => {
    expect(deriveSayTitle("   ", null)).toBe("散場隨筆");
  });
});

describe("formatClock", () => {
  it("格式化為 m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(42)).toBe("0:42");
    expect(formatClock(75)).toBe("1:15");
  });

  it("負數視為 0", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("minutesSinceLabel", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("一分鐘內與未來時間都回「剛散場」", () => {
    expect(minutesSinceLabel("2026-10-08T11:59:40Z", now)).toBe("剛散場");
    expect(minutesSinceLabel("2026-10-08T13:00:00Z", now)).toBe("剛散場");
  });

  it("分鐘 / 小時 / 天逐級換算", () => {
    expect(minutesSinceLabel("2026-10-08T11:42:00Z", now)).toBe(
      "散場後 18 分鐘",
    );
    expect(minutesSinceLabel("2026-10-08T09:00:00Z", now)).toBe(
      "散場後 3 小時",
    );
    expect(minutesSinceLabel("2026-10-05T12:00:00Z", now)).toBe(
      "散場後 3 天",
    );
  });
});
