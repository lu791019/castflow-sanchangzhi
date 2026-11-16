import { describe, expect, it } from "vitest";
import { latestEpisodeLabel, showName, toShowRow } from "./shows";

const latest = {
  aired_at: "2026-10-08T02:00:00Z",
  created_at: "2026-10-09T02:00:00Z",
  episode_number: 122,
  season_number: null,
};

describe("latestEpisodeLabel", () => {
  it("播出日 + 集數", () => {
    expect(latestEpisodeLabel(latest)).toBe("10.08・第 122 集");
  });

  it("有第二季以上寫 S2", () => {
    expect(latestEpisodeLabel({ ...latest, aired_at: "2026-09-30T02:00:00Z", season_number: 2, episode_number: 14 })).toBe(
      "09.30・S2 第 14 集",
    );
  });

  it("沒播出日用入庫時間；沒集數只寫日期", () => {
    expect(latestEpisodeLabel({ ...latest, aired_at: null, episode_number: null })).toBe("10.09");
  });

  it("還沒有集數", () => {
    expect(latestEpisodeLabel(null)).toBe("還沒有新集數");
  });
});

describe("toShowRow", () => {
  it("字卡號碼：季優先，否則集數", () => {
    const base = { id: "f1", url: "https://a.example/feed.xml", title: "慢慢說", author: " 阿寬 ", image_url: null };
    expect(toShowRow({ ...base, latest })).toMatchObject({ name: "慢慢說", no: "122", host: "阿寬" });
    expect(toShowRow({ ...base, latest: { ...latest, season_number: 2 } }).no).toBe("S2");
    expect(toShowRow({ ...base, author: null, latest: null })).toMatchObject({ no: "", host: null });
  });

  it("沒有節目名用主機名", () => {
    expect(showName({ title: "  ", url: "https://feeds.example.com/x.xml" })).toBe("feeds.example.com");
  });
});
