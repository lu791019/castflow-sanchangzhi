import { describe, expect, it } from "vitest";
import { checkLinkForWork, decideUserLinkWrite, parseLinkInput, planUserLink } from "./input";
import { SPOTIFY_AUTO_ADDED_BY } from "./spotify";

describe("parseLinkInput（POST /api/works/[id]/links 邊界）", () => {
  it("合法：kind＋http(s) 網址，label 選填", () => {
    expect(parseLinkInput({ kind: "ticket", url: " https://kktix.com/events/x " })).toEqual({
      ok: true,
      value: { kind: "ticket", url: "https://kktix.com/events/x", label: null },
    });
    expect(parseLinkInput({ kind: "official", url: "http://a.tw/", label: " 北美館 " })).toEqual({
      ok: true,
      value: { kind: "official", url: "http://a.tw/", label: "北美館" },
    });
  });

  it("只收 http(s)", () => {
    expect(parseLinkInput({ kind: "ticket", url: "javascript:alert(1)" })).toEqual({ ok: false, error: "網址要是 http 或 https 開頭" });
    expect(parseLinkInput({ kind: "ticket", url: "data:text/html,x" }).ok).toBe(false);
    expect(parseLinkInput({ kind: "ticket", url: "kktix.com" }).ok).toBe(false);
  });

  it("kind、型別、長度", () => {
    expect(parseLinkInput({ kind: "buy", url: "https://a.tw" })).toEqual({ ok: false, error: "kind 必須是 watch、ticket 或 official" });
    expect(parseLinkInput(null).ok).toBe(false);
    expect(parseLinkInput({ kind: "watch", url: 3 }).ok).toBe(false);
    expect(parseLinkInput({ kind: "watch", url: `https://a.tw/${"x".repeat(2000)}` }).ok).toBe(false);
    expect(parseLinkInput({ kind: "watch", url: "https://a.tw", label: "x".repeat(21) }).ok).toBe(false);
  });
});

describe("planUserLink：白名單內直接公開，外面待審", () => {
  it("白名單售票站", () => {
    expect(planUserLink({ kind: "ticket", url: "https://kktix.com/events/x", label: null })).toEqual({
      source: "kktix",
      label: "KKTIX",
      status: "active",
    });
  });
  it("官網一作品一筆，來源固定 official；白名單外也直接公開（Dex 10/13）", () => {
    expect(planUserLink({ kind: "official", url: "https://www.tfam.museum/x", label: null })).toEqual({
      source: "official",
      label: "官網",
      status: "active",
    });
  });
  it("白名單外的平台：來源用主機名、待審；使用者給的名字優先", () => {
    expect(planUserLink({ kind: "watch", url: "https://www.example.tv/x", label: "某平台" })).toEqual({
      source: "web:example.tv",
      label: "某平台",
      status: "pending",
    });
  });
});

describe("decideUserLinkWrite：同 (work_id, source) 只覆蓋自己補的", () => {
  it("沒有 → 新增；自己補的 → 覆蓋", () => {
    expect(decideUserLinkWrite(null, "u1")).toBe("insert");
    expect(decideUserLinkWrite({ origin: "user", added_by: "u1" }, "u1")).toBe("update");
  });
  it("別人補的、場刊手填、curated、TMDB → 不動", () => {
    expect(decideUserLinkWrite({ origin: "user", added_by: "u2" }, "u1")).toBe("conflict");
    expect(decideUserLinkWrite({ origin: "manual", added_by: "u1" }, "u1")).toBe("conflict");
    expect(decideUserLinkWrite({ origin: "curated", added_by: null }, "u1")).toBe("conflict");
  });
  it("系統自動配對的 Spotify 直連（A②）→ 讀者貼的蓋掉它", () => {
    expect(decideUserLinkWrite({ origin: "curated", added_by: SPOTIFY_AUTO_ADDED_BY }, "u1")).toBe("update");
    // 讀者蓋掉之後就是讀者的（origin user），別人不能再蓋
    expect(decideUserLinkWrite({ origin: "user", added_by: "u1" }, "u2")).toBe("conflict");
  });
});

describe("checkLinkForWork：依作品類別再驗（Q-64）", () => {
  const ALBUM = "4aawyAB9vmqN3uQ7FjRGTy";
  it("音樂貼 Spotify 專輯：正規化網址，白名單內直接公開", () => {
    const checked = checkLinkForWork("music", { kind: "watch", url: `https://open.spotify.com/intl-ja/album/${ALBUM}?si=abc`, label: "亂取的名" });
    expect(checked).toEqual({ ok: true, value: { kind: "watch", url: `https://open.spotify.com/album/${ALBUM}`, label: null } });
    if (checked.ok) expect(planUserLink(checked.value)).toEqual({ source: "spotify", label: "Spotify", status: "active" });
  });
  it("音樂、Podcast 不收 Spotify 以外的網址（白名單外的網域被擋，不進待審）", () => {
    expect(checkLinkForWork("music", { kind: "watch", url: "https://www.kkbox.com/tw/tc/album/x", label: null })).toEqual({ ok: false, error: "在哪聽目前只收 Spotify 連結（open.spotify.com）。" });
    expect(checkLinkForWork("podcast_episode", { kind: "watch", url: "https://evil.example/show/x", label: null }).ok).toBe(false);
    expect(checkLinkForWork("music", { kind: "ticket", url: `https://open.spotify.com/album/${ALBUM}`, label: null }).ok).toBe(false);
  });
  it("類型對不上回錯", () => {
    expect(checkLinkForWork("podcast_episode", { kind: "watch", url: `https://open.spotify.com/album/${ALBUM}`, label: null })).toEqual({ ok: false, error: "這是音樂的連結，這裡要貼節目或單集。" });
  });
  it("影劇、演出不收 Spotify（含短網址）；其他網址照舊", () => {
    expect(checkLinkForWork("movie", { kind: "watch", url: `https://open.spotify.com/album/${ALBUM}`, label: null })).toEqual({ ok: false, error: "Spotify 連結只能補在音樂或 Podcast。" });
    expect(checkLinkForWork("live", { kind: "ticket", url: "https://spotify.link/x", label: null }).ok).toBe(false);
    const ticket = { kind: "ticket" as const, url: "https://kktix.com/events/x", label: null };
    expect(checkLinkForWork("live", ticket)).toEqual({ ok: true, value: ticket });
  });
});
