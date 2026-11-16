import { describe, expect, it } from "vitest";
import { fromTaipei } from "@/lib/journal/time";
import { buildInbox, type InboxSource } from "./inbox";

const at = (month: number, day: number, hour: number, minute = 0) =>
  fromTaipei(2026, month, day, hour, minute).toISOString();
const NOW = fromTaipei(2026, 10, 9, 20);

let seq = 0;
function row(overrides: Partial<InboxSource> = {}, entry: Partial<NonNullable<InboxSource["entry"]>> = {}): InboxSource {
  seq += 1;
  return {
    id: `n${seq}`,
    title: "舊標題",
    body: "舊內文",
    read_at: null,
    created_at: at(10, 9, 12),
    entry: {
      id: `j${seq}`,
      experiencedAt: at(10, 8, 22, 30),
      venue: "home",
      status: "recorded",
      titleFallback: null,
      work: { kind: "series", title: "請回答1988", podcast_show: null, episode_number: 20, poster_url: null },
      ...entry,
    },
    ...overrides,
  };
}

describe("buildInbox", () => {
  it("今天未讀可操作：標題＋提問、meta、說說看連結", () => {
    const inbox = buildInbox([row()], NOW);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.sections).toHaveLength(1);
    expect(inbox.sections[0].label).toBe("今天");
    const [item] = inbox.sections[0].items;
    expect(item.line).toBe("昨晚的《請回答1988》第 20 集，現在想說說嗎？");
    expect(item.meta).toBe("10.08 晚上・在家・今天 12:00");
    expect(item.actionable).toBe(true);
    expect(item.sayHref).toMatch(/^\/say\?journal=j\d+$/);
    expect(item.cover).toBe("poster");
  });

  it("演出：不加書名號、提問帶間隔；方形字卡", () => {
    const inbox = buildInbox(
      [row({}, { work: null, titleFallback: "草地音樂會", venue: "live", experiencedAt: at(10, 3, 20) })],
      NOW,
    );
    const [item] = inbox.sections[0].items;
    expect(item.line).toBe("週六的草地音樂會，隔了 6 天，最記得的是哪一首？");
    expect(item.meta).toBe("10.03 晚上・演出・今天 12:00");
    expect(item.cover).toBe("plate");
  });

  it("已讀或已處理：只顯示標題＋結果，meta 寫「問的」", () => {
    const said = row(
      { read_at: at(10, 8, 13), created_at: at(10, 8, 12) },
      { work: { kind: "movie", title: "海街日記", podcast_show: null, episode_number: null, poster_url: null }, experiencedAt: at(10, 7, 21), status: "said" },
    );
    const pending = row(
      { read_at: at(10, 7, 13), created_at: at(10, 7, 12) },
      {
        venue: "commute",
        experiencedAt: at(10, 7, 8, 35),
        work: { kind: "podcast_episode", title: "ep", podcast_show: "慢慢說", episode_number: 121, poster_url: null },
      },
    );
    const skipped = row({ created_at: at(10, 7, 12) }, { status: "skipped", experiencedAt: at(10, 5, 15) });
    const inbox = buildInbox([said, pending, skipped], NOW);
    expect(inbox.sections.map((s) => s.label)).toEqual(["這週稍早"]);
    const items = inbox.sections[0].items;
    expect(items.map((i) => [i.line, i.meta, i.result])).toEqual([
      ["昨晚的《海街日記》", "10.08 12:00 問的", "said"],
      ["早上通勤聽的《慢慢說》第 121 集", "10.07 12:00 問的", "pending"],
      ["週一的《請回答1988》第 20 集", "10.07 12:00 問的", "skipped"],
    ]);
    expect(items.every((i) => !i.actionable)).toBe(true);
    // 未讀但已只記不說 → 不算可操作，但仍計未讀
    expect(inbox.unreadCount).toBe(1);
  });

  it("超過一週歸「更早」；排序新到舊", () => {
    const old = row({ created_at: at(9, 20, 12), read_at: at(9, 20, 13) });
    const today = row();
    const inbox = buildInbox([old, today], NOW);
    expect(inbox.sections.map((s) => s.label)).toEqual(["今天", "更早"]);
  });

  it("排行程當天提醒：用存下的標題＋內文、標「計畫中」、沒有說說看", () => {
    const view = buildInbox(
      [
        row(
          { kind: "plan_reminder", title: "今天的《海街日記》", body: "散場之後，回來說一句就好。", created_at: at(10, 9, 9) },
          { experiencedAt: at(10, 9, 19), status: "planned", venue: "cinema", work: { kind: "movie", title: "海街日記", podcast_show: null, episode_number: null, poster_url: null } },
        ),
      ],
      NOW,
    );
    const [item] = view.sections[0].items;
    expect(item).toMatchObject({ line: "今天的《海街日記》，散場之後，回來說一句就好。", actionable: false, result: "planned", sayHref: null });
    expect(item.meta).toContain("電影院");
  });

  it("散場當下提醒（settle_prompt）：存下的標題＋內文、可操作、說說看開說一段帶該條目", () => {
    const movie = { kind: "movie" as const, title: "海街日記", podcast_show: null, episode_number: null, poster_url: null };
    const view = buildInbox(
      [
        row(
          { kind: "settle_prompt", title: "散場了？", body: "《海街日記》剛結束。按住，說一段。", created_at: at(10, 9, 19, 30) },
          { id: "j-s", experiencedAt: at(10, 9, 17), status: "planned", venue: "cinema", work: movie },
        ),
      ],
      NOW,
    );
    const [item] = view.sections[0].items;
    expect(item).toMatchObject({
      line: "散場了？《海街日記》剛結束。按住，說一段。",
      actionable: true,
      result: "pending",
      sayHref: "/say?journal=j-s",
      journalId: "j-s",
    });
    expect(item.meta).toBe("10.09 下午・電影院・今天 19:30");
  });

  it("散場當下提醒：已讀或說過後收起，只留標題與作品", () => {
    const movie = { kind: "movie" as const, title: "海街日記", podcast_show: null, episode_number: null, poster_url: null };
    const view = buildInbox(
      [
        row(
          { kind: "settle_prompt", title: "散場了？", body: "《海街日記》剛結束。按住，說一段。", read_at: at(10, 9, 19, 40) },
          { status: "said", venue: "cinema", work: movie },
        ),
        row(
          { kind: "settle_prompt", title: "昨晚的《海街日記》，還記得什麼嗎？", body: "說一段，或打幾句。", read_at: at(10, 9, 10) },
          { status: "recorded", venue: "cinema", work: movie },
        ),
      ],
      NOW,
    );
    const lines = view.sections[0].items.map((item) => [item.line, item.actionable, item.result]);
    expect(lines).toEqual([
      ["散場了？《海街日記》剛結束。", false, "said"],
      ["昨晚的《海街日記》，還記得什麼嗎？", false, "pending"],
    ]);
  });

  it("沒有連到紀錄的通知：用存下的標題，不可操作", () => {
    const inbox = buildInbox([row({ title: "想說說嗎？", entry: null })], NOW);
    const [item] = inbox.sections[0].items;
    expect(item.line).toBe("想說說嗎？");
    expect(item.actionable).toBe(false);
    expect(item.sayHref).toBeNull();
  });

  it("空收件匣", () => {
    expect(buildInbox([], NOW)).toEqual({ sections: [], unreadCount: 0 });
  });
});

describe("listen_prompt（Spotify 聽完一張專輯，Q-64 C1）", () => {
  const listen = (overrides: Partial<InboxSource> = {}) =>
    row({
      kind: "listen_prompt",
      title: "要不要記一筆《帶你飛》？",
      body: "告五人・剛剛聽了 5 首",
      url: "/journal/new?spotifyAlbum=6wlO3VClebIlgMCfBcFbUy",
      created_at: at(10, 9, 19, 30),
      entry: null,
      ...overrides,
    });

  it("未讀：可操作，記一筆連到預選專輯的記一筆，沒有說說看", () => {
    const [item] = buildInbox([listen()], NOW).sections[0].items;
    expect(item).toMatchObject({
      line: "要不要記一筆《帶你飛》？",
      meta: "告五人・剛剛聽了 5 首・今天 19:30",
      actionable: true,
      journalId: null,
      sayHref: null,
      logHref: "/journal/new?spotifyAlbum=6wlO3VClebIlgMCfBcFbUy",
      cover: "plate",
    });
  });

  it("讀過：收起（不可操作），只留問的時間", () => {
    const [item] = buildInbox([listen({ read_at: at(10, 9, 19, 40) })], NOW).sections[0].items;
    expect(item).toMatchObject({ actionable: false, meta: "10.09 19:30 問的" });
  });

  it("網址不是站內記一筆（被竄改、外站）→ 不給連結、不可操作", () => {
    for (const url of ["https://evil.example/journal/new?x=1", "//evil.example", "/journal/new?a=<script>", null]) {
      const [item] = buildInbox([listen({ url })], NOW).sections[0].items;
      expect(item.logHref).toBeNull();
      expect(item.actionable).toBe(false);
    }
  });
});
