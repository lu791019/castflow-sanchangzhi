import { describe, expect, it } from "vitest";
import type { Work } from "@/lib/works/format";
import { toSayWork } from "./say-card";

const base: Work = {
  id: "w1",
  kind: "movie",
  title: "海街日記",
  original_title: "海街diary",
  year: 2015,
  region: "日本",
  credit: "是枝裕和",
  poster_url: "https://img/p.jpg",
  tmdb_id: 331482,
  podcast_show: null,
  episode_number: null,
  synopsis: null,
  slug: "movie-331482",
  issue_no: 7,
  created_at: "2026-10-09T00:00:00Z",
};

describe("toSayWork", () => {
  it("電影：workId=works.id、動詞「看」、類型標籤「電影」、帶海報", () => {
    const now = new Date("2026-10-10T01:00:00Z");
    expect(toSayWork(base, now)).toEqual({
      id: "w1",
      workId: "w1",
      title: "海街日記",
      workTitle: "海街日記",
      categoryLabel: "電影",
      createdAt: now.toISOString(),
      verb: "看",
      note: "剛選的作品",
      posterUrl: "https://img/p.jpg",
    });
  });
  it("Podcast：workTitle 用節目名、動詞「聽」、note 顯示單集標題", () => {
    const pod: Work = {
      ...base,
      kind: "podcast_episode",
      title: "EP703 | 說點什麼",
      podcast_show: "股癌 Gooaye",
      episode_number: 703,
    };
    const card = toSayWork(pod, new Date());
    expect(card.workTitle).toBe("股癌 Gooaye");
    expect(card.verb).toBe("聽");
    expect(card.categoryLabel).toBe("PODCAST");
    expect(card.note).toBe("EP703 | 說點什麼");
  });
});
