import { describe, expect, it } from "vitest";
import { musicListenInfo, musicQuery } from "./music-links";

describe("音樂「在哪聽」（搜尋連結法，不打要金鑰的 API）", () => {
  it("搜尋字：專輯名＋歌手", () => {
    expect(musicQuery({ title: "帶你飛", credit: "告五人" })).toBe("帶你飛 告五人");
    expect(musicQuery({ title: " 帶你飛 ", credit: null })).toBe("帶你飛");
  });

  it("Apple Music 有 id 直連專輯頁，Spotify／KKBOX／YouTube Music 用搜尋網址", () => {
    const info = musicListenInfo({ title: "帶你飛", credit: "告五人", itunes_id: 1670343367 });
    const q = encodeURIComponent("帶你飛 告五人");
    expect(info).toEqual({
      status: "available",
      attribution: null,
      platforms: [
        { name: "Apple Music", note: "專輯頁", url: "https://music.apple.com/tw/album/1670343367" },
        { name: "Spotify", note: "搜尋", url: `https://open.spotify.com/search/${q}` },
        { name: "KKBOX", note: "搜尋", url: `https://www.kkbox.com/tw/tc/search?q=${q}` },
        { name: "YouTube Music", note: "搜尋", url: `https://music.youtube.com/search?q=${q}` },
      ],
    });
  });

  it("手動輸入（沒有 iTunes id）：Apple Music 也改搜尋；沒名字就不給連結", () => {
    const info = musicListenInfo({ title: "地下錄音帶", credit: null, itunes_id: null });
    expect(info.platforms[0]).toEqual({
      name: "Apple Music",
      note: "搜尋",
      url: `https://music.apple.com/tw/search?term=${encodeURIComponent("地下錄音帶")}`,
    });
    expect(musicListenInfo({ title: " ", credit: null, itunes_id: null })).toEqual({ status: "none", platforms: [], attribution: null });
  });
});
