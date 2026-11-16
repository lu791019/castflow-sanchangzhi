import { describe, expect, it } from "vitest";
import {
  DRAFT_TTL_MS,
  isDraftUsable,
  resumeLoginPath,
  stripPrivateWorkFields,
  type SayDraft,
} from "./draft";

const NOW = new Date("2026-10-10T12:00:00Z");
const WORK = {
  id: "w-1",
  workId: "w-1",
  journalId: "j-1",
  title: "海街日記",
  workTitle: "海街日記",
  categoryLabel: "電影",
  createdAt: NOW.toISOString(),
};

function textDraft(overrides: Partial<SayDraft> = {}): SayDraft {
  return { version: 1, savedAt: NOW.toISOString(), work: null, kind: "text", text: "燈亮的時候", ...overrides } as SayDraft;
}

describe("isDraftUsable", () => {
  it("剛存的打字草稿可用", () => {
    expect(isDraftUsable(textDraft(), NOW)).toBe(true);
  });

  it("超過保存期限、版本不符、內容空白都不可用", () => {
    const old = new Date(NOW.getTime() - DRAFT_TTL_MS - 1).toISOString();
    expect(isDraftUsable(textDraft({ savedAt: old }), NOW)).toBe(false);
    expect(isDraftUsable({ ...textDraft(), version: 2 } as unknown as SayDraft, NOW)).toBe(false);
    expect(isDraftUsable(textDraft({ text: "   " } as Partial<SayDraft>), NOW)).toBe(false);
    expect(isDraftUsable(null, NOW)).toBe(false);
  });

  it("錄音草稿要有內容", () => {
    const voice = (size: number): SayDraft => ({
      version: 1,
      savedAt: NOW.toISOString(),
      work: null,
      kind: "voice",
      audio: new Blob([new Uint8Array(size)], { type: "audio/webm" }),
      mimeType: "audio/webm",
      seconds: 12,
    });
    expect(isDraftUsable(voice(10), NOW)).toBe(true);
    expect(isDraftUsable(voice(0), NOW)).toBe(false);
  });
});

describe("stripPrivateWorkFields", () => {
  it("匿名草稿不保存日誌紀錄 id（登入前不可能屬於這個人）", () => {
    expect(stripPrivateWorkFields(WORK)).toEqual({ ...WORK, journalId: null });
    expect(stripPrivateWorkFields(null)).toBeNull();
  });
});

describe("resumeLoginPath", () => {
  it("登入後回到說一段並還原草稿", () => {
    expect(resumeLoginPath()).toBe("/login?next=%2Fsay%3Fresume%3D1");
  });
});
