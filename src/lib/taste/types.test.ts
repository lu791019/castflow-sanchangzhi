import { describe, expect, it } from "vitest";
import { isMediaKey, MEDIA_KEYS, MEDIA_LABELS } from "./types";

describe("MEDIA_KEYS：品味問卷的媒介", () => {
  it("音樂排在 Podcast 後面，標籤「音樂」", () => {
    expect(MEDIA_KEYS).toEqual(["movie", "series", "podcast", "music", "live", "exhibition"]);
    expect(MEDIA_LABELS.music).toBe("音樂");
  });

  it("isMediaKey 收 music，不收清單外的值", () => {
    expect(isMediaKey("music")).toBe(true);
    expect(isMediaKey("podcast")).toBe(true);
    expect(isMediaKey("book")).toBe(false);
    expect(isMediaKey(null)).toBe(false);
  });
});
