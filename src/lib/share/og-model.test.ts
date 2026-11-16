import { describe, expect, it } from "vitest";
import { ogModelText, toOgCardModel, type OgCardInput } from "./og-model";

const BODY = [
  "# 看完《海街日記》，我傳了訊息給很久沒聊的姊姊",
  "",
  "一部幾乎沒有發生大事的電影，讓她在回家的公車上，按下了那句「最近好嗎」。",
  "",
  "燈亮的時候我沒有馬上站起來。旁邊的人都在穿外套了，我還坐著。",
  "",
  "這部片沒有教我什麼道理。它只是讓我想起，有些人一直都在，只是我很久沒有好好看她。",
].join("\n");

const input: OgCardInput = {
  episode: {
    id: "0142abcd-0000-4000-8000-000000000000",
    title: "原始集數標題",
    source: "upload",
    created_at: "2026-10-08T04:00:00.000Z",
    byline: "pen_name",
    pull_quote: "有些人一直都在，只是我很久沒有好好看她。",
  },
  body: BODY,
  work: {
    kind: "movie",
    title: "海街日記",
    poster_url: "https://image.tmdb.org/t/p/w185/poster.jpg",
    podcast_show: null,
    episode_number: null,
    year: 2015,
    venue: null,
    event_date: null,
  },
  penName: "林小晴",
  journal: { journalId: "j1", experiencedAt: "2026-10-07T13:30:00.000Z", venue: "home", verb: "看完" },
};

describe("toOgCardModel", () => {
  it("有海報的電影：A 版、文章標題、作者選的引言、日誌時間差署名", () => {
    const model = toOgCardModel(input);
    expect(model.variant).toBe("poster");
    expect(model.title.text).toBe("看完《海街日記》，我傳了訊息給很久沒聊的姊姊");
    expect(model.quote).toBe("有些人一直都在，只是我很久沒有好好看她。");
    expect(model.author).toBe("林小晴");
    expect(model.seal).toEqual({ shape: 5, chars: ["晴"] });
    expect(model.byline).toBe("10.07 晚上看完・隔天說的");
    expect(model.imageUrl).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
    expect(model.issue).toMatch(/^第 \d{4} 號$/);
  });

  it("匿名署名不露筆名", () => {
    const model = toOgCardModel({ ...input, episode: { ...input.episode, byline: "anonymous" } });
    expect(model.author).toBe("匿名");
    expect(ogModelText(model)).not.toContain("晴");
  });

  it("沒有日誌：退回錄下時刻", () => {
    const model = toOgCardModel({ ...input, journal: null });
    expect(model.byline).toMatch(/^10\.08 12:00 錄下$/);
  });

  it("Podcast：C 版，圖用節目封面", () => {
    const model = toOgCardModel({
      ...input,
      work: { ...input.work!, kind: "podcast_episode", title: "第一次自己租房", podcast_show: "慢慢說", episode_number: 7 },
    });
    expect(model.variant).toBe("podcast");
    expect(model.podcast?.headline).toBe("EP7");
    expect(model.imageUrl).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
  });

  it("沒綁作品：B 版用標題裡的《作品》、不帶圖", () => {
    const model = toOgCardModel({ ...input, work: null });
    expect(model.variant).toBe("plate");
    expect(model.plate.title).toBe("海街日記");
    expect(model.imageUrl).toBeNull();
  });

  it("沒選引言時自動抽句", () => {
    const model = toOgCardModel({ ...input, episode: { ...input.episode, pull_quote: null } });
    expect(model.quote).not.toBeNull();
  });
});

describe("ogModelText", () => {
  it("包含卡上會畫的每一段字", () => {
    const text = ogModelText(toOgCardModel(input));
    for (const char of "散場之後散場誌海街日記隔天說的「") expect(text).toContain(char);
  });
});
