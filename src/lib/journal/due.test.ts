import { describe, expect, it } from "vitest";
import { buildPlanReminders, isDue, isPlanDue, sameDaySiblings, sayUrlFor, toDueReminders, type DueCandidateRow } from "./due";
import { fromTaipei } from "./time";

const NOW = fromTaipei(2026, 10, 8, 12, 5);

function row(overrides: Partial<DueCandidateRow> = {}): DueCandidateRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "owner-uid",
    experienced_at: fromTaipei(2026, 10, 7, 21).toISOString(),
    venue: "cinema",
    status: "recorded",
    remind_at: fromTaipei(2026, 10, 8, 12).toISOString(),
    reminded_at: null,
    work_title_fallback: null,
    episode_id: null,
    works: { title: "海街日記", kind: "movie", podcast_show: null },
    ...overrides,
  };
}

describe("isDue", () => {
  it("recorded + 已到期 + 未提醒 → true", () => {
    expect(isDue(row(), NOW)).toBe(true);
  });

  it("剛好等於 now 也算到期", () => {
    expect(isDue(row({ remind_at: NOW.toISOString() }), NOW)).toBe(true);
  });

  it.each([
    ["未到期", { remind_at: fromTaipei(2026, 10, 10, 12).toISOString() }],
    ["已提醒", { reminded_at: NOW.toISOString() }],
    ["提醒關閉", { remind_at: null }],
    ["已說過", { status: "said" as const }],
    ["只記不說", { status: "skipped" as const }],
    ["已連上文章、尚未發佈", { episode_id: "22222222-2222-2222-2222-222222222222" }],
  ])("%s → false", (_label, overrides) => {
    expect(isDue(row(overrides), NOW)).toBe(false);
  });
});

describe("toDueReminders", () => {
  it("篩掉不到期的、依 remind_at 排序、組文案與網址", () => {
    const later = row({
      id: "22222222-2222-2222-2222-222222222222",
      remind_at: fromTaipei(2026, 10, 8, 12, 1).toISOString(),
      venue: "home",
      works: null,
      work_title_fallback: "只記名稱的片",
      experienced_at: fromTaipei(2026, 10, 7, 23).toISOString(),
    });
    const future = row({ id: "33333333-3333-3333-3333-333333333333", remind_at: "2099-01-01T00:00:00Z" });
    const reminders = toDueReminders([later, future, row()], NOW);

    expect(reminders.map((r) => r.journalEntryId)).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);
    expect(reminders[0]).toEqual({
      journalEntryId: "11111111-1111-1111-1111-111111111111",
      userId: "owner-uid",
      remindAt: fromTaipei(2026, 10, 8, 12).toISOString(),
      experiencedAt: row().experienced_at,
      title: "昨晚的《海街日記》",
      body: "看完 1 天了，現在想說說嗎？說一分鐘就好。",
      url: "/say?journal=11111111-1111-1111-1111-111111111111",
    });
    expect(reminders[1].title).toBe("昨晚的《只記名稱的片》");
  });

  it("沒有 user_id 的舊列歸 default", () => {
    const { user_id: _omit, ...legacy } = row();
    void _omit;
    expect(toDueReminders([legacy], NOW)[0].userId).toBe("default");
  });

  it("Podcast 作品用節目名、通勤聽的；嵌入為陣列也可", () => {
    const [reminder] = toDueReminders(
      [
        row({
          venue: "commute",
          experienced_at: fromTaipei(2026, 10, 8, 8, 35).toISOString(),
          remind_at: fromTaipei(2026, 10, 8, 12).toISOString(),
          works: [{ title: "Ep 12", kind: "podcast_episode", podcast_show: "慢慢說" }],
        }),
      ],
      NOW,
    );
    expect(reminder.title).toBe("早上通勤聽的《慢慢說》");
    expect(reminder.body).toBe("那一集還在你腦子裡嗎？想到什麼就說什麼。");
  });

  it("sayUrlFor 編碼", () => {
    expect(sayUrlFor("a b")).toBe("/say?journal=a%20b");
  });
});

describe("sameDaySiblings（同一天多筆合併成一則）", () => {
  const due = row();
  const sibling = (id: string, overrides: Partial<DueCandidateRow>) =>
    row({ id, remind_at: fromTaipei(2026, 10, 8, 21).toISOString(), ...overrides });

  it("同一位使用者、同一個邏輯日、還沒到期 → 一起帶出", () => {
    const later = sibling("s-later", { experienced_at: fromTaipei(2026, 10, 7, 23, 30).toISOString() });
    // 凌晨 1 點仍算前一晚（4 點換日）
    const pastMidnight = sibling("s-1am", { experienced_at: fromTaipei(2026, 10, 8, 1).toISOString() });
    expect(sameDaySiblings([due], [later, pastMidnight], NOW).map((r) => r.id)).toEqual(["s-later", "s-1am"]);
  });

  it("別天、別人、已提醒、已說、已到期（本來就在清單）→ 不帶", () => {
    const pending = [
      sibling("other-day", { experienced_at: fromTaipei(2026, 10, 8, 9).toISOString() }),
      sibling("other-user", { user_id: "someone-else" }),
      sibling("reminded", { reminded_at: NOW.toISOString() }),
      sibling("said", { status: "said" }),
      sibling("already-due", { remind_at: fromTaipei(2026, 10, 8, 11).toISOString() }),
      sibling("no-remind", { remind_at: null }),
    ];
    expect(sameDaySiblings([due], pending, NOW)).toEqual([]);
  });
});

describe("排行程當天提醒", () => {
  const plan = row({ status: "planned", experienced_at: fromTaipei(2026, 10, 8, 19, 30).toISOString(), remind_at: fromTaipei(2026, 10, 8, 9).toISOString() });

  it("planned 不走 isDue，走 isPlanDue；提醒過就不再", () => {
    expect(isDue(plan, NOW)).toBe(false);
    expect(isPlanDue(plan, NOW)).toBe(true);
    expect(isPlanDue({ ...plan, reminded_at: NOW.toISOString() }, NOW)).toBe(false);
    expect(isPlanDue(row(), NOW)).toBe(false);
  });

  it("組成 plan_reminder，點開那一天的日誌", () => {
    const [reminder] = buildPlanReminders([plan, row()], NOW);
    expect(buildPlanReminders([plan, row()], NOW)).toHaveLength(1);
    expect(reminder).toMatchObject({ kind: "plan_reminder", title: "今天的《海街日記》", url: "/journal?day=2026-10-08", userId: "owner-uid" });
  });
});
