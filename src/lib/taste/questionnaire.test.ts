import { describe, expect, it } from "vitest";
import { parseFollowUps, parsePicks, parseQuestionnaire, parseTasteSettings, toggleMedia, MAX_PICKS } from "./questionnaire";

const WORK = "11111111-1111-4111-8111-111111111111";
const WORK2 = "22222222-2222-4222-8222-222222222222";

describe("parseQuestionnaire：媒介複選＋在家／出門", () => {
  it("合法輸入：去重、保留宣告順序", () => {
    expect(parseQuestionnaire({ media: ["live", "movie", "live"], setting: "out" })).toEqual({
      ok: true,
      value: { media: ["movie", "live"], setting: "out" },
    });
  });
  it("音樂可以選，順序照清單（Podcast 後面）", () => {
    expect(parseQuestionnaire({ media: ["live", "music", "podcast"], setting: "home" })).toEqual({
      ok: true,
      value: { media: ["podcast", "music", "live"], setting: "home" },
    });
    expect(toggleMedia(["movie", "live"], "music")).toEqual(["movie", "music", "live"]);
    expect(toggleMedia(["music"], "music")).toEqual([]);
  });
  it("沒答 setting 是 null、media 可空", () => {
    expect(parseQuestionnaire({ media: [], setting: null })).toEqual({ ok: true, value: { media: [], setting: null } });
    expect(parseQuestionnaire({})).toEqual({ ok: true, value: { media: [], setting: null } });
  });
  it("不在清單的媒介或場域被擋", () => {
    expect(parseQuestionnaire({ media: ["book"] }).ok).toBe(false);
    expect(parseQuestionnaire({ media: "movie" }).ok).toBe(false);
    expect(parseQuestionnaire({ setting: "car" }).ok).toBe(false);
    expect(parseQuestionnaire(null).ok).toBe(false);
  });
});

describe("parsePicks：挑 3 部（看過／想看）", () => {
  it("合法：最多 3 部、同一部只算一次", () => {
    const result = parsePicks([
      { workId: WORK, seen: true },
      { workId: WORK, seen: false },
      { workId: WORK2, seen: false },
    ]);
    expect(result).toEqual({ ok: true, value: [{ workId: WORK, seen: true }, { workId: WORK2, seen: false }] });
  });
  it("超過上限、格式錯誤被擋", () => {
    const many = Array.from({ length: MAX_PICKS + 1 }, (_, i) => ({ workId: WORK.replace("1111-4", `${1000 + i}-4`), seen: true }));
    expect(parsePicks(many).ok).toBe(false);
    expect(parsePicks([{ workId: "x", seen: true }]).ok).toBe(false);
    expect(parsePicks([{ workId: WORK, seen: "yes" }]).ok).toBe(false);
    expect(parsePicks("nope").ok).toBe(false);
  });
  it("空陣列＝這題跳過", () => {
    expect(parsePicks([])).toEqual({ ok: true, value: [] });
    expect(parsePicks(undefined)).toEqual({ ok: true, value: [] });
  });
});

describe("toggleMedia", () => {
  it("加入時照固定順序、再點一次移除", () => {
    expect(toggleMedia(["live"], "movie")).toEqual(["movie", "live"]);
    expect(toggleMedia(["movie", "live"], "movie")).toEqual(["live"]);
  });
});

describe("parseFollowUps：④縣市、⑤演出想看哪種（Q-63）", () => {
  it("沒帶就是沒答（不寫）", () => {
    expect(parseFollowUps({}, ["live"])).toEqual({ ok: true, value: { city: undefined, liveKinds: undefined } });
  });

  it("④縣市：白名單、台 → 臺；null＝都可以", () => {
    expect(parseFollowUps({ city: "台中市" }, ["exhibition"])).toEqual({ ok: true, value: { city: "臺中市", liveKinds: undefined } });
    expect(parseFollowUps({ city: null }, ["live"])).toEqual({ ok: true, value: { city: null, liveKinds: undefined } });
    expect(parseFollowUps({ city: "東京都" }, ["live"]).ok).toBe(false);
    expect(parseFollowUps({ city: 3 }, ["live"]).ok).toBe(false);
  });

  it("⑤演出種類：去重、照固定順序；空陣列當沒答", () => {
    expect(parseFollowUps({ liveKinds: ["festival", "concert", "festival"] }, ["live"])).toEqual({
      ok: true,
      value: { city: undefined, liveKinds: ["concert", "festival"] },
    });
    expect(parseFollowUps({ liveKinds: [] }, ["live"])).toEqual({ ok: true, value: { city: undefined, liveKinds: undefined } });
    expect(parseFollowUps({ liveKinds: ["opera"] }, ["live"]).ok).toBe(false);
    expect(parseFollowUps({ liveKinds: "concert" }, ["live"]).ok).toBe(false);
  });

  it("沒勾到的題不收：沒勾演出或展覽不收縣市、沒勾演出不收演出種類", () => {
    expect(parseFollowUps({ city: "臺北市" }, ["movie"]).ok).toBe(false);
    expect(parseFollowUps({ city: null }, []).ok).toBe(false);
    expect(parseFollowUps({ liveKinds: ["dance"] }, ["exhibition"]).ok).toBe(false);
    expect(parseFollowUps({ city: "臺北市", liveKinds: ["dance"] }, ["exhibition"]).ok).toBe(false);
  });

  it("格式不對被擋", () => {
    expect(parseFollowUps(null, ["live"]).ok).toBe(false);
  });
});

describe("parseTasteSettings：設定頁品味（①②＋④⑤，同問卷驗證）", () => {
  it("只改①②：④⑤沒帶就不寫", () => {
    expect(parseTasteSettings({ media: ["live", "movie"], setting: "out" })).toEqual({
      ok: true,
      value: { questionnaire: { media: ["movie", "live"], setting: "out" }, city: undefined, liveKinds: undefined },
    });
  });

  it("④縣市：同問卷白名單、台 → 臺；null＝都可以", () => {
    expect(parseTasteSettings({ media: ["exhibition"], setting: null, city: "台南市" })).toMatchObject({ ok: true, value: { city: "臺南市" } });
    expect(parseTasteSettings({ media: ["live"], setting: null, city: null })).toMatchObject({ ok: true, value: { city: null } });
    expect(parseTasteSettings({ media: ["live"], setting: null, city: "東京都" }).ok).toBe(false);
  });

  it("⑤演出種類：照固定順序；設定頁送空陣列＝全部取消（要寫空的，問卷裡才是沒答）", () => {
    expect(parseTasteSettings({ media: ["live"], setting: null, liveKinds: ["festival", "concert"] })).toMatchObject({
      ok: true,
      value: { liveKinds: ["concert", "festival"] },
    });
    expect(parseTasteSettings({ media: ["live"], setting: null, liveKinds: [] })).toMatchObject({ ok: true, value: { liveKinds: [] } });
    expect(parseTasteSettings({ media: ["live"], setting: null, liveKinds: ["opera"] }).ok).toBe(false);
  });

  it("①沒勾到的題一律不收（含⑤清空）", () => {
    expect(parseTasteSettings({ media: ["movie"], setting: null, city: "臺北市" }).ok).toBe(false);
    expect(parseTasteSettings({ media: ["exhibition"], setting: null, liveKinds: ["dance"] }).ok).toBe(false);
    expect(parseTasteSettings({ media: ["exhibition"], setting: null, liveKinds: [] }).ok).toBe(false);
  });

  it("①②格式不對被擋", () => {
    expect(parseTasteSettings({ media: ["book"] }).ok).toBe(false);
    expect(parseTasteSettings(null).ok).toBe(false);
  });
});
