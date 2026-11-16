import { describe, expect, it } from "vitest";
import { buildSettlePrompts, isPlannedAhead, type SettleCandidateRow } from "./settle-due";
import { fromTaipei, HOUR_MS } from "./time";

const SHOW = fromTaipei(2026, 10, 14, 19, 0);
// 電影預設 130＋15 → 21:25 散場
const SETTLE = fromTaipei(2026, 10, 14, 21, 25);
const NOW = fromTaipei(2026, 10, 14, 22, 0);

function row(overrides: Partial<SettleCandidateRow> = {}): SettleCandidateRow {
  return {
    id: "e1",
    user_id: "u1",
    work_id: "w1",
    experienced_at: SHOW.toISOString(),
    created_at: new Date(SHOW.getTime() - 24 * HOUR_MS).toISOString(),
    venue: "cinema",
    status: "planned",
    episode_id: null,
    work_title_fallback: null,
    works: { title: "海街日記", kind: "movie", podcast_show: null, runtime_minutes: null },
    ...overrides,
  };
}

const none = { notified: new Set<string>(), said: [] };

describe("isPlannedAhead", () => {
  it("先排行程（建立早於場次）才算", () => {
    expect(isPlannedAhead(row())).toBe(true);
    expect(isPlannedAhead(row({ created_at: new Date(SHOW.getTime() + HOUR_MS).toISOString() }))).toBe(false);
    // 與記一筆判斷 planned 同一個容差（10 分鐘）：「剛剛」記下、時鐘略快的不算排行程
    expect(isPlannedAhead(row({ created_at: new Date(SHOW.getTime() - 5 * 60 * 1000).toISOString() }))).toBe(false);
    expect(isPlannedAhead(row({ created_at: new Date(SHOW.getTime() - 11 * 60 * 1000).toISOString() }))).toBe(true);
  });
});

describe("buildSettlePrompts", () => {
  it("到點的 planned 電影：一則 settle_prompt，推播，深連結開說一段帶該條目", () => {
    const [prompt, ...rest] = buildSettlePrompts([row()], none, NOW);
    expect(rest).toHaveLength(0);
    expect(prompt).toEqual({
      journalEntryId: "e1",
      userId: "u1",
      remindAt: SETTLE.toISOString(),
      experiencedAt: SHOW.toISOString(),
      title: "散場了？",
      body: "《海街日記》剛結束。說一段，或打幾句。",
      url: "/say?journal=e1",
      kind: "settle_prompt",
      push: true,
    });
  });

  it("settlePlans 先轉成 recorded 仍照 settleAt 判斷", () => {
    expect(buildSettlePrompts([row({ status: "recorded" })], none, NOW)).toHaveLength(1);
  });

  it("片長有值就用：100 分 → 20:55 散場，22:56 已過窗口", () => {
    const withRuntime = row({ works: { title: "海街日記", kind: "movie", podcast_show: null, runtime_minutes: 100 } });
    expect(buildSettlePrompts([withRuntime], none, fromTaipei(2026, 10, 14, 22, 56))).toHaveLength(0);
    expect(buildSettlePrompts([withRuntime], none, fromTaipei(2026, 10, 14, 22, 54))).toHaveLength(1);
  });

  it("還沒散場、事後補記（非排行程）、影集、說過／略過 → 不推", () => {
    expect(buildSettlePrompts([row()], none, fromTaipei(2026, 10, 14, 21, 0))).toHaveLength(0);
    expect(buildSettlePrompts([row({ created_at: NOW.toISOString() })], none, NOW)).toHaveLength(0);
    expect(
      buildSettlePrompts([row({ works: { title: "影集", kind: "series", podcast_show: null } })], none, NOW),
    ).toHaveLength(0);
    expect(buildSettlePrompts([row({ status: "said" })], none, NOW)).toHaveLength(0);
    expect(buildSettlePrompts([row({ status: "skipped" })], none, NOW)).toHaveLength(0);
    expect(buildSettlePrompts([row({ episode_id: "ep1" })], none, NOW)).toHaveLength(0);
  });

  it("去重：已有 settle_prompt 通知的條目不再帶出", () => {
    expect(buildSettlePrompts([row()], { notified: new Set(["e1"]), said: [] }, NOW)).toHaveLength(0);
  });

  it("散場前已記過這部（同作品、同天有內容）→ 不推", () => {
    const said = [{ userId: "u1", workId: "w1", at: fromTaipei(2026, 10, 14, 21, 40).toISOString() }];
    expect(buildSettlePrompts([row()], { notified: new Set(), said }, NOW)).toHaveLength(0);
  });

  it("別人說過、不同作品、前一天說過 → 照推", () => {
    const said = [
      { userId: "u2", workId: "w1", at: NOW.toISOString() },
      { userId: "u1", workId: "w2", at: NOW.toISOString() },
      { userId: "u1", workId: "w1", at: fromTaipei(2026, 10, 13, 20).toISOString() },
    ];
    expect(buildSettlePrompts([row()], { notified: new Set(), said }, NOW)).toHaveLength(1);
  });

  it("只記名稱（沒作品）用名稱比對同天說過", () => {
    const manual = row({ work_id: null, works: null, work_title_fallback: "某部片" });
    const said = [{ userId: "u1", workId: null, titleFallback: "某部片", at: NOW.toISOString() }];
    expect(buildSettlePrompts([manual], { notified: new Set(), said }, NOW)).toHaveLength(0);
    const [prompt] = buildSettlePrompts([manual], none, NOW);
    expect(prompt.body).toBe("《某部片》剛結束。說一段，或打幾句。");
  });

  it("深夜散場：隔天 09:00 起一則「昨晚的…」只進收件匣（push false）", () => {
    const late = row({ experienced_at: fromTaipei(2026, 10, 14, 22, 0).toISOString() }); // 00:25 散場
    expect(buildSettlePrompts([late], none, fromTaipei(2026, 10, 15, 0, 40))).toHaveLength(0);
    const [prompt] = buildSettlePrompts([late], none, fromTaipei(2026, 10, 15, 9, 3));
    expect(prompt).toMatchObject({
      title: "昨晚的《海街日記》，還記得什麼嗎？",
      body: "說一段，或打幾句。",
      push: false,
      kind: "settle_prompt",
      remindAt: fromTaipei(2026, 10, 15, 9).toISOString(),
      url: "/say?journal=e1",
    });
  });

  it("依 remindAt 舊到新", () => {
    const early = row({ id: "e0", experienced_at: fromTaipei(2026, 10, 14, 18, 50).toISOString() });
    expect(buildSettlePrompts([row(), early], none, NOW).map((p) => p.journalEntryId)).toEqual(["e0", "e1"]);
  });
});
