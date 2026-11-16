import { describe, expect, it } from "vitest";
import {
  fitFooter,
  fitOgTitle,
  ogImageUrl,
  ogFontText,
  pickOgVariant,
  plateText,
  podcastText,
  verticalRuns,
} from "./og-card";

const movie = {
  kind: "movie" as const,
  title: "海街日記",
  poster_url: "https://image.tmdb.org/t/p/w500/x.jpg",
  podcast_show: null,
  episode_number: null,
  year: 2015,
  venue: null,
  event_date: null,
};

describe("pickOgVariant", () => {
  it("影視有海報 → poster；Podcast → podcast；其他 → 直排字卡", () => {
    expect(pickOgVariant(movie)).toBe("poster");
    expect(pickOgVariant({ ...movie, poster_url: null })).toBe("plate");
    expect(pickOgVariant({ ...movie, kind: "podcast_episode" })).toBe("podcast");
    expect(pickOgVariant({ ...movie, kind: "live" })).toBe("plate");
    expect(pickOgVariant(null)).toBe("plate");
  });
});

describe("fitOgTitle", () => {
  it("兩行內（22 字）用 60", () => {
    expect(fitOgTitle("看完《海街日記》，我傳了訊息給很久沒聊的姊姊")).toEqual({
      text: "看完《海街日記》，我傳了訊息給很久沒聊的姊姊",
      fontSize: 60,
    });
  });

  it("較長改 44（三行內）", () => {
    const title = "看完《海街日記》，我在回家的公車上傳了訊息給很久沒聊的姊姊，她回了一隻貓";
    expect(fitOgTitle(title).fontSize).toBe(44);
    expect(fitOgTitle(title).text).toBe(title);
  });

  it("再長就截斷加「…」", () => {
    const title = "一".repeat(60);
    const fitted = fitOgTitle(title);
    expect(fitted.fontSize).toBe(44);
    expect(fitted.text.endsWith("…")).toBe(true);
    expect(Array.from(fitted.text).length).toBeLessThanOrEqual(43);
  });
});

describe("plateText", () => {
  it("演出：作品名、場地、「演出・日期」", () => {
    expect(
      plateText({ ...movie, kind: "live", title: "島嶼夜歌", poster_url: null, year: null, venue: "草地音樂會", event_date: "2026-10-04" }, null),
    ).toEqual({ title: "島嶼夜歌", titleSize: 60, subtitle: "草地音樂會", label: "演出・2026.10.04" });
  });

  it("沒海報的電影：「電影・年份」，沒有副標", () => {
    expect(plateText({ ...movie, poster_url: null }, null)).toMatchObject({ subtitle: null, label: "電影・2015" });
  });

  it("沒綁作品：用標題裡的作品名，再沒有就用欄目名", () => {
    expect(plateText(null, "島嶼夜歌")).toMatchObject({ title: "島嶼夜歌", label: "隨筆" });
    expect(plateText(null, null)).toMatchObject({ title: "散場之後", label: "隨筆" });
  });

  it("直排作品名越長字越小，太長截斷", () => {
    expect(plateText(null, "一二三四五六七八九").titleSize).toBe(46);
    expect(plateText(null, "一二三四五六七八九十一二").titleSize).toBe(36);
    const long = plateText(null, "一".repeat(20));
    expect(long.titleSize).toBe(36);
    expect(long.title).toBe(`${"一".repeat(12)}…`);
  });
});

describe("podcastText", () => {
  it("有集數：EP 大字、節目名、〈單集名〉", () => {
    expect(
      podcastText({ ...movie, kind: "podcast_episode", title: "第一次自己租房", podcast_show: "慢慢說", episode_number: 7 }),
    ).toEqual({ headline: "EP7", show: "慢慢說", episodeTitle: "〈第一次自己租房〉" });
  });

  it("沒集數：大字改放節目名", () => {
    expect(
      podcastText({ ...movie, kind: "podcast_episode", title: "Why France Is in Crisis", podcast_show: "The Daily", episode_number: null }),
    ).toMatchObject({ headline: "The Daily", show: null });
  });
});

describe("verticalRuns", () => {
  it("中文直立、連續的拉丁數字合成一段橫躺", () => {
    expect(verticalRuns("演出・2026.10.04")).toEqual([
      { text: "演出・", upright: true },
      { text: "2026.10.04", upright: false },
    ]);
  });
});

describe("ogFontText", () => {
  it("去重的字元集合，給 Google Fonts text= 子集", () => {
    expect(ogFontText(["散場之後", "散場", null, "散場誌"])).toBe("散場之後散場誌".split("").filter((c, i, a) => a.indexOf(c) === i).join(""));
  });
});

describe("ogImageUrl", () => {
  it("TMDB 縮圖換成 w780，其他網址不動", () => {
    expect(ogImageUrl("https://image.tmdb.org/t/p/w185/abc.jpg")).toBe("https://image.tmdb.org/t/p/w780/abc.jpg");
    expect(ogImageUrl("https://files.soundon.fm/x.jpeg")).toBe("https://files.soundon.fm/x.jpeg");
  });
});

describe("fitFooter", () => {
  it("放得下就原樣（設計稿 B 的長署名）", () => {
    expect(fitFooter("阿哲", "10.04 晚上聽完・散場後 40 分鐘說的")).toEqual({
      author: "阿哲",
      byline: "10.04 晚上聽完・散場後 40 分鐘說的",
    });
  });

  it("太寬時先拿掉時間差那段，只留「幾號在哪看完」", () => {
    expect(fitFooter("測試2bjcs21ao", "10.04 在現場聽完・散場後 40 分鐘說的")).toEqual({
      author: "測試2bjcs21ao",
      byline: "10.04 在現場聽完",
    });
  });

  it("筆名本身太長：拿掉署名時刻，筆名截斷加「…」", () => {
    const fitted = fitFooter("一二三四五六七八九十一二三四五六七八九十", "10.07 晚上看完・隔天說的");
    expect(fitted.byline).toBe("");
    expect(fitted.author.endsWith("…")).toBe(true);
    expect(fitted.author.length).toBeLessThan(20);
  });
});
