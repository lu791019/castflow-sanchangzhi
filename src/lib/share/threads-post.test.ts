import { describe, expect, it } from "vitest";
import {
  composeThreadsPost,
  shortOneLiner,
  shortQuote,
  threadsIntentUrl,
  threadsPostForArticle,
  threadsTag,
  THREADS_TARGET_CHARS,
} from "./threads-post";

const URL = "castflow.app/s/0142";

describe("shortQuote", () => {
  it("40 字內原句照搬，去掉作者自己加的「」", () => {
    expect(shortQuote("「有些人一直都在，只是我很久沒有好好看她。」")).toBe(
      "有些人一直都在，只是我很久沒有好好看她。",
    );
  });

  it("超過 40 字取第一個句號前（含句號）", () => {
    const quote = "那間房間很小，但燈關不關，第一次由我決定。後來我搬過很多次家，每一次都想起那盞燈，想起那個晚上的自己。";
    expect(shortQuote(quote)).toBe("那間房間很小，但燈關不關，第一次由我決定。");
  });

  it("第一句仍超過 40 字：截到 40 字內最後一個逗號＋「……」", () => {
    const quote = "我在回家的公車上一直想著那一幕，想著她們坐在簷廊一起吃飯的樣子，想著我和姊姊小時候也是那樣等大人回家的晚上。";
    const result = shortQuote(quote);
    expect(result).toBe("我在回家的公車上一直想著那一幕，想著她們坐在簷廊一起吃飯的樣子……");
    expect(Array.from(result!).length).toBeLessThanOrEqual(42);
  });

  it("空白回 null", () => {
    expect(shortQuote("  ")).toBeNull();
    expect(shortQuote(null)).toBeNull();
  });
});

describe("shortOneLiner", () => {
  it("40 字內保留", () => {
    expect(shortOneLiner("看完《海街日記》，在回家的公車上，傳了訊息給很久沒聊的姊姊。")).toBe(
      "看完《海街日記》，在回家的公車上，傳了訊息給很久沒聊的姊姊。",
    );
  });

  it("超過上限：以子句為單位縮短，句尾補句號", () => {
    const text = "一部幾乎沒有發生大事的電影，讓她在回家的公車上，按下了那句「最近好嗎」，然後等了很久很久才收到回覆。";
    expect(shortOneLiner(text, 30)).toBe("一部幾乎沒有發生大事的電影，讓她在回家的公車上。");
  });

  it("第一個子句就超過上限回 null（不硬切半句）", () => {
    expect(shortOneLiner("一二三四五六七八九十一二三四五六七八九十", 10)).toBeNull();
  });
});

describe("threadsTag", () => {
  it("電影用作品名", () => {
    expect(threadsTag({ kind: "movie", title: "海街日記", podcast_show: null }, null)).toBe("#海街日記");
  });

  it("Podcast 用節目名，去掉空白與 #", () => {
    expect(threadsTag({ kind: "podcast_episode", title: "第一次自己租房", podcast_show: "The Daily #2" }, null)).toBe(
      "#TheDaily2",
    );
  });

  it("沒綁作品時退回標題裡的《作品》；都沒有回 null", () => {
    expect(threadsTag(null, "島嶼夜歌")).toBe("#島嶼夜歌");
    expect(threadsTag(null, null)).toBeNull();
  });
});

describe("composeThreadsPost", () => {
  const base = {
    quote: "有些人一直都在，只是我很久沒有好好看她。",
    oneLiner: "看完《海街日記》，在回家的公車上，傳了訊息給很久沒聊的姊姊。",
    url: URL,
    tag: "#海街日記",
    visibility: "public" as const,
  };

  it("結構：「引言」、一句話、連結、#作品名，段落空一行", () => {
    expect(composeThreadsPost(base)).toBe(
      [
        "「有些人一直都在，只是我很久沒有好好看她。」",
        "看完《海街日記》，在回家的公車上，傳了訊息給很久沒聊的姊姊。",
        URL,
        "#海街日記",
      ].join("\n\n"),
    );
  });

  it("只給有連結的人也產生；私人不產生", () => {
    expect(composeThreadsPost({ ...base, visibility: "unlisted" })).not.toBeNull();
    expect(composeThreadsPost({ ...base, visibility: "private" })).toBeNull();
  });

  it("缺引言或一句話或作品名時略過該段，連結一定在", () => {
    expect(composeThreadsPost({ ...base, quote: null, oneLiner: null, tag: null })).toBe(URL);
  });

  it("太長時先縮一句話，再截引言到第一個逗號＋「……」，連結永遠保留", () => {
    const longUrl = "https://castflow-web-abcdefghij-an.a.run.app/s/abcdefghij";
    const post = composeThreadsPost({
      ...base,
      url: longUrl,
      oneLiner: "散場後我在公車上把手機拿出來，打了一句最近好嗎，又刪掉，又打回來，最後還是送出去了。",
      quote: "那間房間很小，但燈關不關，第一次由我決定，這件事我記了好多年好多年好多年。",
    })!;
    expect(Array.from(post).length).toBeLessThanOrEqual(THREADS_TARGET_CHARS);
    expect(post).toContain(longUrl);
    expect(post.startsWith("「那間房間很小……」")).toBe(true);
  });

  it("不加驚嘆號、emoji、標題或署名（只用給定的段落）", () => {
    const post = composeThreadsPost(base)!;
    expect(post).not.toMatch(/[!！]/);
    expect(post.split("\n\n")).toHaveLength(4);
  });
});

describe("threadsPostForArticle", () => {
  it("由文章欄位組出模板：Podcast 標籤用節目名", () => {
    const post = threadsPostForArticle({
      visibility: "unlisted",
      pullQuote: "那間房間很小，但燈關不關，第一次由我決定。",
      lede: "通勤路上聽《慢慢說》，想起第一次自己租的房間。",
      work: { kind: "podcast_episode", title: "第一次自己租房", podcast_show: "慢慢說" },
      workTitle: null,
      shareUrl: "https://castflow.app/s/abc",
    });
    expect(post).toBe(
      "「那間房間很小，但燈關不關，第一次由我決定。」\n\n通勤路上聽《慢慢說》，想起第一次自己租的房間。\n\nhttps://castflow.app/s/abc\n\n#慢慢說",
    );
    expect(threadsIntentUrl(post!)).toBe(`https://www.threads.net/intent/post?text=${encodeURIComponent(post!)}`);
  });

  it("私人不產生", () => {
    expect(
      threadsPostForArticle({ visibility: "private", pullQuote: "x", lede: "y", work: null, workTitle: null, shareUrl: "u" }),
    ).toBeNull();
  });
});
