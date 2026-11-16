import { describe, expect, it } from "vitest";
import {
  buildDesk,
  deskEyebrow,
  deskStatLine,
  deskTabOf,
  deskThumb,
  deskTimeLabel,
  draftStatus,
  parseDeskTab,
  publishedMeta,
  scheduleWhenLabel,
  socialPostsHref,
  timeLeftLabel,
  type DeskEpisodeRow,
} from "./desk";

// 2026-10-10 22:00 台北
const NOW = new Date("2026-10-10T14:00:00Z");

function row(overrides: Partial<DeskEpisodeRow> = {}): DeskEpisodeRow {
  return {
    id: "00a0b1c2-0000-4000-8000-000000000001",
    title: "原來我等的不是結局",
    source: "audio",
    status: "transcribed",
    created_at: "2026-10-10T01:12:00Z",
    published_at: null,
    share_slug: null,
    visibility: "public",
    work: null,
    contents: [],
    ...overrides,
  };
}

const blog = (body: string, original: string | null = body) => ({
  platform: "blog",
  status: "draft",
  scheduled_at: null,
  body,
  original_body: original,
});

describe("deskTabOf", () => {
  it("有排程中的貼文 → 排程中（即使文章已發佈）", () => {
    const scheduled = row({
      published_at: "2026-10-08T01:00:00Z",
      contents: [{ platform: "threads", status: "scheduled", scheduled_at: "2026-10-12T01:00:00Z", body: "", original_body: null }],
    });
    expect(deskTabOf(scheduled)).toBe("scheduled");
  });

  it("已發佈 → 已發佈；其餘 → 草稿", () => {
    expect(deskTabOf(row({ published_at: "2026-10-08T01:00:00Z" }))).toBe("published");
    expect(deskTabOf(row())).toBe("drafts");
  });

  it("status=scheduled 但沒有時間不算排程", () => {
    expect(deskTabOf(row({ contents: [{ platform: "threads", status: "scheduled", scheduled_at: null, body: "", original_body: null }] }))).toBe("drafts");
  });
});

describe("draftStatus", () => {
  it("整理好、沒改過 → 還沒校樣", () => {
    expect(draftStatus(row({ contents: [blog("a")] }))).toEqual({ status: "整理好了，還沒校樣", half: false });
  });

  it("正文與原稿不同 → 校樣到一半", () => {
    expect(draftStatus(row({ contents: [blog("改過", "原稿")] }))).toEqual({ status: "校樣到一半", half: true });
  });

  it("沒有正文：依轉錄狀態", () => {
    expect(draftStatus(row({ status: "error" })).status).toBe("沒有轉成文字");
    expect(draftStatus(row({ status: "transcribed" })).status).toBe("文字在，還沒整理");
    expect(draftStatus(row({ status: "uploaded" })).status).toBe("還在轉成文字");
  });
});

describe("deskThumb / deskEyebrow", () => {
  const series = { kind: "series" as const, title: "請回答1988", poster_url: "https://img/p.jpg", podcast_show: null, episode_number: null };
  const pod = { kind: "podcast_episode" as const, title: "第 121 集", poster_url: null, podcast_show: "慢慢說", episode_number: 121 };

  it("有海報用海報；沒海報直排字卡；podcast 方形字卡；沒綁作品斜線", () => {
    expect(deskThumb(series)).toEqual({ kind: "poster", url: "https://img/p.jpg" });
    expect(deskThumb({ ...series, poster_url: null })).toEqual({ kind: "plate", text: "請回答1988" });
    expect(deskThumb(pod)).toEqual({ kind: "pod", text: "慢慢說", no: "121" });
    expect(deskThumb(null)).toEqual({ kind: "hatch" });
  });

  it("eyebrow", () => {
    expect(deskEyebrow(series)).toBe("影集・請回答1988");
    expect(deskEyebrow(pod)).toBe("Podcast・慢慢說　第 121 集");
    expect(deskEyebrow(null)).toBe("還沒選作品");
  });
});

describe("時間文案", () => {
  it("deskTimeLabel 以台北日曆日判斷今天／昨天", () => {
    expect(deskTimeLabel("2026-10-10T01:12:00Z", NOW)).toBe("今天 09:12");
    expect(deskTimeLabel("2026-10-09T15:40:00Z", NOW)).toBe("昨天 23:40");
    expect(deskTimeLabel("2026-10-06T03:00:00Z", NOW)).toBe("10.06");
    expect(deskTimeLabel("2025-12-31T03:00:00Z", NOW)).toBe("2025.12.31");
  });

  it("scheduleWhenLabel", () => {
    expect(scheduleWhenLabel("2026-10-12T01:00:00Z")).toBe("10.12 週一 早上 9:00");
    expect(scheduleWhenLabel("2026-10-10T13:00:00Z")).toBe("10.10 週六 晚上 21:00");
  });

  it("timeLeftLabel", () => {
    expect(timeLeftLabel("2026-10-12T01:00:00Z", NOW)).toBe("還有 1 天 11 小時");
    expect(timeLeftLabel("2026-10-10T17:00:00Z", NOW)).toBe("還有 3 小時");
    expect(timeLeftLabel("2026-10-10T14:20:00Z", NOW)).toBe("還有 20 分鐘");
    expect(timeLeftLabel("2026-10-10T13:00:00Z", NOW)).toBe("時間到了，發佈中");
  });
});

describe("publishedMeta", () => {
  it("期號 + 發佈日 + 公開範圍", () => {
    const meta = publishedMeta({ id: "008e0000-0000-4000-8000-000000000000", published_at: "2026-10-08T03:00:00Z", visibility: "unlisted" });
    // 008e → 142 → 1142
    expect(meta).toBe("第 1142 號・10.08 發佈・只給有連結的人");
  });
});

describe("buildDesk", () => {
  it("分三疊、排除 RSS 集數、已發佈連到分享頁", () => {
    const desk = buildDesk(
      [
        row({ id: "d1", contents: [blog("a")] }),
        row({ id: "rss", source: "rss" }),
        row({ id: "p1", published_at: "2026-10-08T03:00:00Z", share_slug: "abc" }),
        row({ id: "p2", published_at: "2026-10-09T03:00:00Z", share_slug: null }),
        row({
          id: "s1",
          contents: [
            { platform: "threads", status: "scheduled", scheduled_at: "2026-10-12T01:00:00Z", body: "", original_body: null },
            { platform: "facebook", status: "scheduled", scheduled_at: "2026-10-12T02:00:00Z", body: "", original_body: null },
          ],
        }),
      ],
      NOW,
    );
    expect(desk.drafts.map((d) => d.id)).toEqual(["d1"]);
    expect(desk.drafts[0].href).toBe("/proof/d1");
    expect(desk.published.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(desk.published[1].href).toBe("/s/abc");
    expect(desk.published[0].href).toBe("/proof/p2");
    expect(desk.scheduled[0]).toMatchObject({
      id: "s1",
      scheduledAt: "2026-10-12T01:00:00Z",
      platforms: "Threads、FB",
      published: false,
    });
  });

  it("統計行", () => {
    expect(deskStatLine({ drafts: [], scheduled: [], published: [] })).toBe("還沒有草稿，也還沒發佈過。");
    const desk = buildDesk([row({ id: "d1" }), row({ id: "p", published_at: "2026-10-08T03:00:00Z" })], NOW);
    expect(deskStatLine(desk)).toBe("1 份草稿・0 篇排程中・1 篇已發佈");
  });

  it("parseDeskTab 不認得的值回草稿", () => {
    expect(parseDeskTab("published")).toBe("published");
    expect(parseDeskTab("x")).toBe("drafts");
    expect(parseDeskTab(undefined)).toBe("drafts");
  });
});

describe("socialPostsHref（Q-55：社群貼文移到編輯檯，只在六平台都產出時顯示）", () => {
  const post = (platform: string, body = "貼文") => ({ platform, status: "draft", scheduled_at: null, body, original_body: body });
  const SOCIAL = ["threads", "facebook", "instagram", "linkedin", "newsletter"];

  it("blog 加五個社群平台都有內容 → 連到舊編輯器", () => {
    const full = row({ contents: [blog("a"), ...SOCIAL.map((platform) => post(platform))] });
    expect(socialPostsHref(full)).toBe(`/episodes/${full.id}/edit`);
  });

  it("缺任何一個平台或內容空白 → 不顯示", () => {
    expect(socialPostsHref(row({ contents: [blog("a")] }))).toBeNull();
    expect(socialPostsHref(row({ contents: [blog("a"), ...SOCIAL.slice(1).map((platform) => post(platform))] }))).toBeNull();
    expect(socialPostsHref(row({ contents: [blog("a"), ...SOCIAL.map((platform) => post(platform, platform === "threads" ? " " : "x"))] }))).toBeNull();
  });

  it("buildDesk 每一疊都帶 socialHref", () => {
    const full = row({ id: "p1", published_at: "2026-10-09T00:00:00Z", share_slug: "abc", contents: [blog("a"), ...SOCIAL.map((platform) => post(platform))] });
    const desk = buildDesk([full, row({ id: "d1", contents: [blog("a")] })], NOW);
    expect(desk.published[0].socialHref).toBe("/episodes/p1/edit");
    expect(desk.drafts[0].socialHref).toBeNull();
  });
});
