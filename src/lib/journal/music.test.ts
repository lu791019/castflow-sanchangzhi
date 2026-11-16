import { describe, expect, it } from "vitest";
import { buildPlanCopy, buildReminderCopy, reminderQuestion } from "./remind";
import { fromTaipei } from "./time";
import { entryByline, entryMeta, entryTitle, monthStatLine, type JournalViewEntry } from "./view";
import { workCategory } from "./wording";

const at = (month: number, day: number, hour: number, minute = 0) => fromTaipei(2026, month, day, hour, minute).toISOString();

const album = { kind: "music" as const, title: "帶你飛", podcast_show: null, episode_number: null, poster_url: null };

function entry(overrides: Partial<JournalViewEntry> = {}): JournalViewEntry {
  return {
    id: "m1",
    experiencedAt: at(10, 7, 21, 40),
    venue: "home",
    status: "recorded",
    companions: null,
    titleFallback: null,
    work: album,
    article: null,
    ...overrides,
  };
}

describe("日誌：音樂", () => {
  it("作品類別是 music；只記名稱沒有音樂場域，照舊看場域", () => {
    expect(workCategory("music", "home")).toBe("music");
    expect(workCategory(null, "home")).toBe("screen");
  });

  it("列：專輯名、「音樂・在家」", () => {
    expect(entryTitle(entry())).toBe("帶你飛");
    expect(entryMeta(entry())).toBe("音樂・在家");
  });

  it("署名用「聽完」", () => {
    expect(entryByline(entry({ status: "said", article: { href: "/s/x", saidAt: at(10, 7, 21, 58), typed: false } }))).toBe(
      "10.07 晚上聽完・聽完後 18 分鐘說的",
    );
  });

  it("月份刊頭：聽了幾張", () => {
    expect(monthStatLine([entry(), entry({ id: "m2" })])).toBe("聽了 2 張專輯。");
  });

  it("提醒文案：今天要聽、隔天問哪一首", () => {
    expect(buildPlanCopy({ workTitle: "帶你飛", kind: "music", venue: "home" })).toEqual({
      title: "今天要聽的《帶你飛》",
      body: "聽完回來說一句就好。",
    });
    const asked = new Date(at(10, 8, 12));
    const copy = buildReminderCopy({ workTitle: "帶你飛", kind: "music", experiencedAt: new Date(at(10, 7, 21)), venue: "home", askedAt: asked });
    expect(copy).toEqual({ title: "昨晚聽的《帶你飛》", body: "哪一首還在腦子裡轉？想到什麼就說什麼。" });
    expect(reminderQuestion({ kind: "music", experiencedAt: new Date(at(10, 7, 21)), venue: "home", askedAt: asked })).toBe(
      "哪一首還在腦子裡轉？",
    );
  });
});
