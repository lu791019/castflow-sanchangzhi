import { describe, expect, it } from "vitest";
import { decideSend, isLetterOpen, letterPatch, parseAuthorAction, type LetterEpisode } from "./policy";

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const READER = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-10T01:12:00Z");

const OPEN: LetterEpisode = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: AUTHOR,
  visibility: "public",
  byline: "pen_name",
  published_at: "2026-10-08T00:00:00Z",
};

describe("isLetterOpen：只有以筆名署名、公開發佈的文章開放回信", () => {
  it("公開＋筆名＋已發佈", () => {
    expect(isLetterOpen(OPEN)).toBe(true);
  });

  it("匿名署名、只給有連結的人、私人、未發佈、舊資料作者都不開放", () => {
    expect(isLetterOpen({ ...OPEN, byline: "anonymous" })).toBe(false);
    expect(isLetterOpen({ ...OPEN, visibility: "unlisted" })).toBe(false);
    expect(isLetterOpen({ ...OPEN, visibility: "private" })).toBe(false);
    expect(isLetterOpen({ ...OPEN, published_at: null })).toBe(false);
    expect(isLetterOpen({ ...OPEN, user_id: "default" })).toBe(false);
  });
});

describe("decideSend", () => {
  const base = { episode: OPEN, senderId: READER, senderPenName: "雨青", alreadySent: false, blocked: false };

  it("一般讀者：送達", () => {
    expect(decideSend(base)).toEqual({ kind: "deliver" });
  });

  it("文章不開放 → 404；寫給自己 → 403；沒筆名 → 403；寄過 → 409", () => {
    expect(decideSend({ ...base, episode: null })).toMatchObject({ kind: "reject", status: 404 });
    expect(decideSend({ ...base, episode: { ...OPEN, byline: "anonymous" } })).toMatchObject({ kind: "reject", status: 404 });
    expect(decideSend({ ...base, senderId: AUTHOR })).toMatchObject({ kind: "reject", status: 403 });
    expect(decideSend({ ...base, senderPenName: null })).toMatchObject({ kind: "reject", status: 403 });
    expect(decideSend({ ...base, alreadySent: true })).toMatchObject({ kind: "reject", status: 409 });
  });

  it("被封鎖：照樣「寄出」但不送達（不明示）", () => {
    expect(decideSend({ ...base, blocked: true })).toEqual({ kind: "suppress" });
  });

  it("被封鎖但已寄過：仍回 409，跟沒被封鎖一樣", () => {
    expect(decideSend({ ...base, blocked: true, alreadySent: true })).toMatchObject({ kind: "reject", status: 409 });
  });
});

describe("parseAuthorAction", () => {
  it("合法動作", () => {
    expect(parseAuthorAction({ action: "publish" })).toEqual({ ok: true, action: { type: "publish" } });
    expect(parseAuthorAction({ action: "reply", reply: " 那就打吧。 " })).toEqual({
      ok: true,
      action: { type: "reply", text: "那就打吧。" },
    });
    expect(parseAuthorAction({ action: "block" })).toEqual({ ok: true, action: { type: "block" } });
  });

  it("未知動作、空回覆、超過 140 字擋下", () => {
    expect(parseAuthorAction({ action: "delete" })).toMatchObject({ ok: false });
    expect(parseAuthorAction(null)).toMatchObject({ ok: false });
    expect(parseAuthorAction({ action: "reply", reply: "" })).toMatchObject({ ok: false });
    expect(parseAuthorAction({ action: "reply", reply: "字".repeat(141) })).toMatchObject({ ok: false });
  });
});

describe("letterPatch", () => {
  const letter = { status: "none" as const, reply: null, reported_at: null };

  it("刊登／只放在這裡／撤下", () => {
    expect(letterPatch(letter, { type: "publish" }, NOW)).toEqual({
      ok: true,
      patch: { status: "published", published_at: NOW.toISOString() },
    });
    expect(letterPatch(letter, { type: "keep" }, NOW)).toEqual({
      ok: true,
      patch: { status: "kept", published_at: null },
    });
    expect(letterPatch({ ...letter, status: "published" }, { type: "unpublish" }, NOW)).toEqual({
      ok: true,
      patch: { status: "none", published_at: null },
    });
  });

  it("已刊登再按刊登：不改刊登日", () => {
    expect(letterPatch({ ...letter, status: "published" }, { type: "publish" }, NOW)).toEqual({ ok: true, patch: {} });
  });

  it("回覆一次；第二次 409", () => {
    expect(letterPatch(letter, { type: "reply", text: "謝謝" }, NOW)).toEqual({
      ok: true,
      patch: { reply: "謝謝", replied_at: NOW.toISOString() },
    });
    expect(letterPatch({ ...letter, reply: "謝謝" }, { type: "reply", text: "再一次" }, NOW)).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("檢舉：記下時間、已刊登的撤成只放在這裡；之後不能刊登", () => {
    expect(letterPatch({ ...letter, status: "published" }, { type: "report" }, NOW)).toEqual({
      ok: true,
      patch: { reported_at: NOW.toISOString(), status: "kept", published_at: null },
    });
    expect(letterPatch(letter, { type: "report" }, NOW)).toEqual({
      ok: true,
      patch: { reported_at: NOW.toISOString() },
    });
    const reported = { ...letter, reported_at: NOW.toISOString() };
    expect(letterPatch(reported, { type: "report" }, NOW)).toEqual({ ok: true, patch: {} });
    expect(letterPatch(reported, { type: "publish" }, NOW)).toMatchObject({ ok: false, status: 409 });
  });
});
