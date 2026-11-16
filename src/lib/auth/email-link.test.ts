import { describe, expect, it } from "vitest";
import { parseEmailLink } from "./email-link";

describe("parseEmailLink（登入信連結回跳參數）", () => {
  it("token_hash＋type=email：走 verifyOtp", () => {
    expect(parseEmailLink(new URLSearchParams("token_hash=pkce_abc123&type=email"))).toEqual({ kind: "otp", tokenHash: "pkce_abc123", type: "email" });
  });

  it("magiclink、signup 也收（舊信或不同信種）", () => {
    expect(parseEmailLink(new URLSearchParams("token_hash=abc&type=magiclink"))).toMatchObject({ kind: "otp", type: "magiclink" });
    expect(parseEmailLink(new URLSearchParams("token_hash=abc&type=signup"))).toMatchObject({ kind: "otp", type: "signup" });
  });

  it("沒帶 type 當 email", () => {
    expect(parseEmailLink(new URLSearchParams("token_hash=abc"))).toEqual({ kind: "otp", tokenHash: "abc", type: "email" });
  });

  it("不在白名單的 type、格式怪的 token 不收", () => {
    expect(parseEmailLink(new URLSearchParams("token_hash=abc&type=recovery"))).toEqual({ kind: "none" });
    expect(parseEmailLink(new URLSearchParams("token_hash=a%20b&type=email"))).toEqual({ kind: "none" });
    expect(parseEmailLink(new URLSearchParams(`token_hash=${"a".repeat(300)}&type=email`))).toEqual({ kind: "none" });
  });

  it("舊版 PKCE code 照收", () => {
    expect(parseEmailLink(new URLSearchParams("code=xyz"))).toEqual({ kind: "code", code: "xyz" });
  });

  it("兩個都有時用 token_hash（不依賴這個瀏覽器的 cookie）", () => {
    expect(parseEmailLink(new URLSearchParams("code=xyz&token_hash=abc&type=email"))).toMatchObject({ kind: "otp" });
  });

  it("什麼都沒有", () => {
    expect(parseEmailLink(new URLSearchParams(""))).toEqual({ kind: "none" });
  });
});
