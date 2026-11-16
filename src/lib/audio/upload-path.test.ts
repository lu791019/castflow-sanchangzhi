import { describe, expect, it } from "vitest";
import {
  audioPathFromPublicUrl,
  storedAudioPath,
  buildAudioUploadPath,
  isOwnAudioUploadPath,
  validateEpisodeTitle,
  MAX_EPISODE_TITLE_LENGTH,
} from "./upload-path";

const UID = "6f1c2a3b-0000-4000-8000-000000000001";

describe("buildAudioUploadPath", () => {
  it("放在使用者自己的目錄，檔名只留安全字元", () => {
    expect(buildAudioUploadPath(UID, "我的 節目#1.m4a", 1700000000000)).toBe(
      `episodes/${UID}/1700000000000-______1.m4a`,
    );
  });

  it("空檔名給預設名", () => {
    expect(buildAudioUploadPath(UID, "", 1)).toBe(`episodes/${UID}/1-audio`);
  });

  it("超長檔名截斷", () => {
    const path = buildAudioUploadPath(UID, `${"a".repeat(500)}.mp3`, 1);
    expect(path.length).toBeLessThanOrEqual(`episodes/${UID}/1-`.length + 120);
  });
});

describe("isOwnAudioUploadPath", () => {
  it("自己的路徑通過", () => {
    expect(isOwnAudioUploadPath(UID, buildAudioUploadPath(UID, "a.mp3", 1))).toBe(true);
  });

  it.each([
    `episodes/other-user/1-a.mp3`,
    `episodes/${UID}/../other/1-a.mp3`,
    `episodes/${UID}/`,
    `episodes/${UID}/sub/1-a.mp3`,
    `say/${UID}/1-a.mp3`,
    "",
  ])("拒絕 %s", (path) => {
    expect(isOwnAudioUploadPath(UID, path)).toBe(false);
  });
});

describe("validateEpisodeTitle", () => {
  it("去頭尾空白", () => {
    expect(validateEpisodeTitle("  標題 ")).toEqual({ ok: true, title: "標題" });
  });

  it.each(["", "   ", 42, null])("拒絕空值或非字串 %s", (value) => {
    expect(validateEpisodeTitle(value).ok).toBe(false);
  });

  it("拒絕過長", () => {
    expect(validateEpisodeTitle("字".repeat(MAX_EPISODE_TITLE_LENGTH + 1)).ok).toBe(false);
  });
});

describe("audioPathFromPublicUrl", () => {
  const uid = "11111111-1111-4111-8111-111111111111";
  const base = "http://127.0.0.1:54321/storage/v1/object/public/audio/";

  it("自己的錄音 → 儲存路徑", () => {
    expect(audioPathFromPublicUrl(uid, `${base}episodes/${uid}/1700000000000-say.webm`)).toBe(
      `episodes/${uid}/1700000000000-say.webm`,
    );
  });

  it("別人的、格式不符、空值 → null", () => {
    expect(audioPathFromPublicUrl(uid, `${base}episodes/other/1-say.webm`)).toBeNull();
    expect(audioPathFromPublicUrl(uid, `${base}episodes/${uid}/../x`)).toBeNull();
    expect(audioPathFromPublicUrl(uid, "https://cdn.example/a.mp3")).toBeNull();
    expect(audioPathFromPublicUrl(uid, null)).toBeNull();
  });
});

describe("storedAudioPath", () => {
  const base = "http://127.0.0.1:54321/storage/v1/object/public/audio/";

  it("取回儲存桶內路徑（去掉 query）", () => {
    expect(storedAudioPath(`${base}episodes/u1/1-say.webm?x=1`)).toBe("episodes/u1/1-say.webm");
  });

  it("外部網址、空值、含 .. 回 null", () => {
    expect(storedAudioPath("https://cdn.example/a.mp3")).toBeNull();
    expect(storedAudioPath(null)).toBeNull();
    expect(storedAudioPath(`${base}`)).toBeNull();
    expect(storedAudioPath(`${base}episodes/../secret`)).toBeNull();
  });
});
