import { describe, expect, it } from "vitest";
import { episodeCaption } from "./work-caption";

const base = { id: "w1", poster_url: null };

describe("episodeCaption（Podcast 選了某一集，作品卡下方的集數標題，UX-27）", () => {
  it("有集數：第 N 集・標題", () => {
    expect(
      episodeCaption({ ...base, kind: "podcast_episode", title: "EP12 去京都的那一週", podcast_show: "百靈果 News", episode_number: 12 }),
    ).toBe("第 12 集・EP12 去京都的那一週");
  });

  it("沒集數：只有標題", () => {
    expect(episodeCaption({ ...base, kind: "podcast_episode", title: "週末特輯", podcast_show: "百靈果 News", episode_number: null })).toBe(
      "週末特輯",
    );
  });

  it("標題就是節目名（舊資料）或不是 Podcast → 不顯示", () => {
    expect(episodeCaption({ ...base, kind: "podcast_episode", title: "百靈果 News", podcast_show: "百靈果 News", episode_number: null })).toBeNull();
    expect(episodeCaption({ ...base, kind: "movie", title: "你的名字", podcast_show: null, episode_number: null })).toBeNull();
  });
});
