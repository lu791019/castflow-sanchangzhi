import { describe, expect, it } from "vitest";
import {
  baseTitle,
  matchAlbum,
  matchKey,
  matchShow,
  sameArtist,
  sameTitle,
  versionMarkers,
  type SpotifyAlbumCandidate,
  type SpotifyShowCandidate,
} from "./match";

function album(name: string, artists: string[], extra: Partial<SpotifyAlbumCandidate> = {}): SpotifyAlbumCandidate {
  return { id: `id-${name}-${artists.join("+")}`, name, album_type: "album", total_tracks: 10, artists, ...extra };
}

function show(name: string, extra: Partial<SpotifyShowCandidate> = {}): SpotifyShowCandidate {
  return { id: `show-${name}`, name, publisher: null, description: null, ...extra };
}

describe("正規化", () => {
  it("全形半形、大小寫、空白與標點都不影響比對鍵", () => {
    expect(matchKey("ＡＢＣ　Ｌｏｖｅ！")).toBe(matchKey("abc love!"));
    expect(matchKey("帶你飛（豪華版）")).toBe(matchKey("帶你飛 (豪華版)"));
    expect(matchKey("I'm Fine")).toBe(matchKey("I’m fine"));
  });

  it("主標題拿掉括號備註、Single 字尾、帶版本說明的破折號後段", () => {
    expect(baseTitle("Abbey Road (Remastered)")).toBe("abbeyroad");
    expect(baseTitle("帶你飛 - Single")).toBe("帶你飛");
    expect(baseTitle("Let It Be - 2009 Remaster")).toBe("letitbe");
    // 破折號後段不是版本說明就不拿（名稱本身有破折號）
    expect(baseTitle("Sunrise - Sunset")).toBe("sunrisesunset");
  });

  it("版本標記中英都認", () => {
    expect(versionMarkers("XXX (Deluxe Edition)")).toEqual(["deluxe"]);
    expect(versionMarkers("XXX（豪華版）")).toEqual(["deluxe"]);
    expect(versionMarkers("Fearless (Taylor's Version)")).toEqual(["version"]);
    expect(versionMarkers("XXX 演唱會 Live")).toEqual(["live"]);
    expect(versionMarkers("Alive")).toEqual([]);
  });
});

describe("sameTitle", () => {
  it("完全相同（正規化後）算", () => {
    expect(sameTitle("帶你飛", "帶你飛")).toBe(true);
    expect(sameTitle("MIDNIGHTS", "Midnights")).toBe(true);
  });

  it("只差無關備註（原聲帶、feat.）算", () => {
    expect(sameTitle("Your Name.", "Your Name. (Original Motion Picture Soundtrack)")).toBe(true);
  });

  it("版本不同不算：豪華版、Live、Taylor's Version", () => {
    expect(sameTitle("帶你飛", "帶你飛 (豪華版)")).toBe(false);
    expect(sameTitle("帶你飛（豪華版）", "帶你飛")).toBe(false);
    expect(sameTitle("Fearless", "Fearless (Taylor's Version)")).toBe(false);
    expect(sameTitle("XXX", "XXX (Live)")).toBe(false);
  });

  it("譯名不猜", () => {
    expect(sameTitle("愛的萬物論", "The Theory of Everything")).toBe(false);
  });
});

describe("sameArtist", () => {
  it("主要藝人相同算，合作專輯只看第一位", () => {
    expect(sameArtist("告五人", ["告五人"])).toBe(true);
    expect(sameArtist("Taylor Swift & Ed Sheeran", ["Taylor Swift", "Ed Sheeran"])).toBe(true);
    expect(sameArtist("Taylor Swift", ["Taylor Swift", "Bon Iver"])).toBe(true);
    expect(sameArtist("Ed Sheeran & Taylor Swift", ["Taylor Swift", "Ed Sheeran"])).toBe(false);
  });

  it("團名含 & 不會被拆壞", () => {
    expect(sameArtist("Simon & Garfunkel", ["Simon & Garfunkel"])).toBe(true);
    expect(sameArtist("Florence + the Machine", ["Florence + The Machine"])).toBe(true);
  });

  it("譯名、群星、沒有藝人都不算", () => {
    expect(sameArtist("泰勒絲", ["Taylor Swift"])).toBe(false);
    expect(sameArtist("Various Artists", ["Various Artists"])).toBe(false);
    expect(sameArtist("群星", ["群星"])).toBe(false);
    expect(sameArtist(null, ["告五人"])).toBe(false);
    expect(sameArtist("告五人", [])).toBe(false);
  });
});

describe("matchAlbum", () => {
  it("同名同藝人 → 那一張", () => {
    const hit = album("帶你飛", ["告五人"]);
    expect(matchAlbum({ title: "帶你飛", credit: "告五人" }, [album("運氣來得若有似無", ["告五人"]), hit])).toBe(hit);
  });

  it("同名不同藝人 → 不寫", () => {
    expect(matchAlbum({ title: "Home", credit: "告五人" }, [album("Home", ["Someone Else"])])).toBeNull();
  });

  it("譯名（藝人或專輯名不同語言）→ 不寫", () => {
    expect(matchAlbum({ title: "1989", credit: "泰勒絲" }, [album("1989", ["Taylor Swift"])])).toBeNull();
    expect(matchAlbum({ title: "愛的萬物論", credit: "Jóhann Jóhannsson" }, [album("The Theory of Everything", ["Jóhann Jóhannsson"])])).toBeNull();
  });

  it("豪華版：作品是標準版只有豪華版 → 不寫；作品是豪華版 → 挑豪華版", () => {
    const deluxe = album("帶你飛 (豪華版)", ["告五人"], { total_tracks: 14 });
    const standard = album("帶你飛", ["告五人"]);
    expect(matchAlbum({ title: "帶你飛", credit: "告五人" }, [deluxe])).toBeNull();
    expect(matchAlbum({ title: "帶你飛（豪華版）", credit: "告五人" }, [standard, deluxe])).toBe(deluxe);
    expect(matchAlbum({ title: "帶你飛", credit: "告五人" }, [deluxe, standard])).toBe(standard);
  });

  it("單曲與專輯同名：用 iTunes 曲目數挑", () => {
    const single = album("帶你飛", ["告五人"], { album_type: "single", total_tracks: 1 });
    const full = album("帶你飛", ["告五人"], { total_tracks: 10 });
    expect(matchAlbum({ title: "帶你飛", credit: "告五人", trackCount: 10 }, [single, full])).toBe(full);
    expect(matchAlbum({ title: "帶你飛", credit: "告五人", trackCount: 1 }, [single, full])).toBe(single);
  });

  it("單曲與專輯同名、沒有曲目數（補跑既有作品）→ 分不出來，不寫", () => {
    const single = album("帶你飛", ["告五人"], { album_type: "single", total_tracks: 1 });
    const full = album("帶你飛", ["告五人"], { total_tracks: 10 });
    expect(matchAlbum({ title: "帶你飛", credit: "告五人" }, [single, full])).toBeNull();
  });

  it("作品是專輯、Spotify 只有同名單曲 → 不寫", () => {
    const single = album("帶你飛", ["告五人"], { album_type: "single", total_tracks: 1 });
    expect(matchAlbum({ title: "帶你飛", credit: "告五人", trackCount: 10 }, [single])).toBeNull();
  });

  it("曲目數差一點（bonus track）但只有一張同型的 → 收", () => {
    const full = album("帶你飛", ["告五人"], { total_tracks: 11 });
    expect(matchAlbum({ title: "帶你飛", credit: "告五人", trackCount: 10 }, [full])).toBe(full);
  });

  it("同一張重複上架（同型同曲目數）→ 取第一個", () => {
    const first = album("帶你飛", ["告五人"], { id: "a" });
    const second = album("帶你飛", ["告五人"], { id: "b" });
    expect(matchAlbum({ title: "帶你飛", credit: "告五人" }, [first, second])).toBe(first);
  });

  it("合輯（compilation）、沒有藝人、空名稱 → 不寫", () => {
    expect(matchAlbum({ title: "Hits", credit: "Various Artists" }, [album("Hits", ["Various Artists"], { album_type: "compilation" })])).toBeNull();
    expect(matchAlbum({ title: "帶你飛", credit: null }, [album("帶你飛", ["告五人"])])).toBeNull();
    expect(matchAlbum({ title: " ", credit: "告五人" }, [album(" ", ["告五人"])])).toBeNull();
  });
});

describe("matchShow", () => {
  it("名稱完全相同且唯一 → 那個節目", () => {
    const hit = show("Gooaye 股癌");
    expect(matchShow({ show: "Gooaye 股癌", credit: "謝孟恭" }, [hit, show("Gooaye 股癌 - test hacked")])).toBe(hit);
  });

  it("全形半形、大小寫不同也算", () => {
    const hit = show("Gooaye 股癌");
    expect(matchShow({ show: "ＧＯＯＡＹＥ　股癌", credit: null }, [hit])).toBe(hit);
  });

  it("只有名字包含（盜版、剪輯台）→ 不寫", () => {
    expect(matchShow({ show: "股癌", credit: null }, [show("Gooaye 股癌"), show("股癌精華")])).toBeNull();
  });

  it("同名節目不只一個 → 分不出來，不寫", () => {
    expect(matchShow({ show: "大人的週末", credit: null }, [show("大人的週末", { id: "a" }), show("大人的週末", { id: "b" })])).toBeNull();
  });

  it("有 publisher 時要對得上發行者", () => {
    expect(matchShow({ show: "The Daily", credit: "The New York Times" }, [show("The Daily", { publisher: "Someone" })])).toBeNull();
    const hit = show("The Daily", { publisher: "The New York Times" });
    expect(matchShow({ show: "The Daily", credit: "The New York Times" }, [hit])).toBe(hit);
  });

  it("名稱太短：描述要提到發行者才算", () => {
    expect(matchShow({ show: "日常", credit: "小明" }, [show("日常", { description: "聊聊生活" })])).toBeNull();
    const hit = show("日常", { description: "主持人小明聊聊生活" });
    expect(matchShow({ show: "日常", credit: "小明" }, [hit])).toBe(hit);
  });

  it("沒有節目名稱 → 不寫", () => {
    expect(matchShow({ show: "", credit: "x" }, [show("")])).toBeNull();
  });
});
