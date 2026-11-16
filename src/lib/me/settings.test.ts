import { describe, expect, it } from "vitest";
import {
  dayClockLabel,
  needsAddToHome,
  notifyStatusLine,
  reminderExample,
  reminderTitle,
  showsCountLabel,
} from "./settings";

const NOW = new Date("2026-10-10T14:30:00Z"); // 台北 22:30

describe("reminderExample", () => {
  it("隔天中午：今晚 22:30 → 明天 12:00", () => {
    expect(reminderExample("next_noon", NOW)).toEqual({
      fromLabel: "如果現在記下一筆",
      fromTime: "今晚 22:30",
      toLabel: "問你想不想說",
      toTime: "明天 12:00",
      muted: false,
    });
  });

  it("半天後：+12 小時", () => {
    expect(reminderExample("half_day", NOW).toTime).toBe("明天 10:30");
  });

  it("不提醒", () => {
    expect(reminderExample("off", NOW)).toMatchObject({ toLabel: "留在日誌裡", toTime: "不會問你", muted: true });
  });
});

describe("dayClockLabel", () => {
  it("今天早上叫今天、晚上叫今晚、後天以後寫日期", () => {
    expect(dayClockLabel(new Date("2026-10-10T01:00:00Z"), NOW)).toBe("今天 09:00");
    expect(dayClockLabel(new Date("2026-10-12T04:00:00Z"), NOW)).toBe("10.12 12:00");
  });
});

describe("其他", () => {
  it("reminderTitle", () => {
    expect(reminderTitle("half_day")).toBe("半天後");
    expect(reminderTitle("off")).toBe("不提醒");
  });

  it("notifyStatusLine", () => {
    expect(notifyStatusLine("granted")).toBe("已開啟");
    expect(notifyStatusLine("default")).toBe("尚未開啟・提醒會先放在收件匣");
  });

  it("needsAddToHome：iPhone Safari 非主畫面才提示", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(needsAddToHome(iphone, false)).toBe(true);
    expect(needsAddToHome(iphone, true)).toBe(false);
    expect(needsAddToHome("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", false, 0)).toBe(false);
    expect(needsAddToHome("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", false, 5)).toBe(true);
  });

  it("showsCountLabel", () => {
    expect(showsCountLabel(3)).toBe("3 個節目");
    expect(showsCountLabel(0)).toBe("還沒有");
  });
});
