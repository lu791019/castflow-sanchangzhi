import { describe, expect, it } from "vitest";
import { toInboxSource } from "./inbox-row";

describe("toInboxSource", () => {
  it("嵌入紀錄與作品", () => {
    const source = toInboxSource({
      id: "n1",
      title: "t",
      body: "b",
      read_at: null,
      created_at: "c",
      journal_entries: {
        id: "j1",
        experienced_at: "e",
        venue: "home",
        status: "recorded",
        work_title_fallback: null,
        works: [{ kind: "movie", title: "海街日記", podcast_show: null, episode_number: null, poster_url: null }],
      },
    });
    expect(source.entry?.id).toBe("j1");
    expect(source.entry?.work?.title).toBe("海街日記");
  });

  it("沒有紀錄或資料不合法 → entry null", () => {
    expect(toInboxSource({ id: "n", title: "t", body: "b", read_at: null, created_at: "c", journal_entries: null }).entry).toBeNull();
    expect(
      toInboxSource({
        id: "n",
        title: "t",
        body: "b",
        read_at: null,
        created_at: "c",
        journal_entries: { id: "j", experienced_at: "e", venue: "moon", status: "recorded", work_title_fallback: null },
      }).entry,
    ).toBeNull();
  });
  it("kind：plan_reminder、settle_prompt 照帶，其他當 say_reminder", () => {
    const base = { id: "n", title: "t", body: "b", read_at: null, created_at: "c", journal_entries: null };
    expect(toInboxSource({ ...base, kind: "settle_prompt" }).kind).toBe("settle_prompt");
    expect(toInboxSource({ ...base, kind: "plan_reminder" }).kind).toBe("plan_reminder");
    expect(toInboxSource({ ...base, kind: "weird" }).kind).toBe("say_reminder");
  });

  it("listen_prompt 照帶 kind 與 url（migration 041）", () => {
    const base = { id: "n", title: "t", body: "b", read_at: null, created_at: "c", journal_entries: null };
    expect(toInboxSource({ ...base, kind: "listen_prompt", url: "/journal/new?spotifyAlbum=x" })).toMatchObject({
      kind: "listen_prompt",
      url: "/journal/new?spotifyAlbum=x",
      entry: null,
    });
    expect(toInboxSource(base).url).toBeNull();
  });
});
