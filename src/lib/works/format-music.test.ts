import { describe, expect, it } from "vitest";
import {
  isListenKind,
  isMusic,
  isSquareCover,
  KIND_LABELS,
  posterSourceLabel,
  pickerKindForWork,
  posterCardLabel,
  posterCardNumber,
  workDisplayName,
  workMetaLine,
  workVerb,
} from "./format";

const album = {
  kind: "music" as const,
  title: "帶你飛",
  original_title: null,
  year: 2023,
  region: null,
  credit: "告五人",
  podcast_show: null,
  episode_number: null,
};

describe("音樂作品（專輯）", () => {
  it("類別標籤是「音樂」、動詞「聽」", () => {
    expect(KIND_LABELS.music).toBe("音樂");
    expect(workVerb(album)).toBe("聽");
  });

  it("meta 行：年份 · 歌手（不加「導演」）", () => {
    expect(workMetaLine(album)).toBe("2023 · 告五人");
    expect(workMetaLine({ ...album, year: null })).toBe("告五人");
  });

  it("稱呼專輯用書名號，字卡大字是發行年、側標是「音樂・歌手」", () => {
    expect(workDisplayName(album)).toBe("《帶你飛》");
    expect(posterCardNumber(album)).toBe("2023");
    expect(posterCardLabel(album)).toBe("音樂・告五人");
    expect(posterCardLabel({ ...album, credit: null })).toBe("音樂");
  });

  it("選擇器開在音樂分頁", () => {
    expect(pickerKindForWork(album)).toBe("music");
  });

  it("isMusic／isListenKind／isSquareCover：Podcast 與音樂是方形封面、用「聽」", () => {
    expect(isMusic(album)).toBe(true);
    expect(isMusic({ kind: "podcast_episode" })).toBe(false);
    expect(isListenKind({ kind: "music" })).toBe(true);
    expect(isListenKind({ kind: "podcast_episode" })).toBe(true);
    expect(isListenKind({ kind: "live" })).toBe(false);
    expect(isSquareCover({ kind: "music" })).toBe(true);
    expect(isSquareCover({ kind: "podcast_episode" })).toBe(true);
    expect(isSquareCover({ kind: "movie" })).toBe(false);
  });

  it("圖說來源", () => {
    expect(posterSourceLabel({ kind: "music" })).toBe("專輯封面 · Apple Music");
    expect(posterSourceLabel({ kind: "podcast_episode" })).toBe("節目封面");
    expect(posterSourceLabel({ kind: "movie" })).toBe("海報 · TMDB");
  });
});
