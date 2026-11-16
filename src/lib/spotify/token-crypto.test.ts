import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, TokenKeyError, tokenKeyFromEnv } from "./token-crypto";

const KEY = randomBytes(32);

describe("token-crypto", () => {
  it("加密後解得回來；每次 IV 不同，密文不含明文", () => {
    const a = encryptToken("refresh-abc", "user-1", KEY);
    const b = encryptToken("refresh-abc", "user-1", KEY);
    expect(a).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("refresh-abc");
    expect(decryptToken(a, "user-1", KEY)).toBe("refresh-abc");
  });

  it("換 user_id（搬到別人的列）或換金鑰 → 解不開", () => {
    const sealed = encryptToken("refresh-abc", "user-1", KEY);
    expect(() => decryptToken(sealed, "user-2", KEY)).toThrow();
    expect(() => decryptToken(sealed, "user-1", randomBytes(32))).toThrow();
  });

  it("被竄改或格式不對 → 丟錯", () => {
    const sealed = encryptToken("refresh-abc", "user-1", KEY);
    const [v, iv, tag, body] = sealed.split(":");
    const flipped = `${body.slice(0, -2)}${body.endsWith("AA") ? "BB" : "AA"}`;
    expect(() => decryptToken([v, iv, tag, flipped].join(":"), "user-1", KEY)).toThrow();
    expect(() => decryptToken("v2:a:b:c", "user-1", KEY)).toThrow("格式");
    expect(() => decryptToken("plain-token", "user-1", KEY)).toThrow("格式");
  });

  it("SPOTIFY_TOKEN_KEY：沒設或不是 32 bytes → TokenKeyError，訊息不帶金鑰", () => {
    expect(() => tokenKeyFromEnv({})).toThrow(TokenKeyError);
    const short = Buffer.from("short").toString("base64");
    expect(() => tokenKeyFromEnv({ SPOTIFY_TOKEN_KEY: short })).toThrow(/32 bytes/);
    try {
      tokenKeyFromEnv({ SPOTIFY_TOKEN_KEY: short });
    } catch (error) {
      expect(String(error)).not.toContain(short);
    }
    expect(tokenKeyFromEnv({ SPOTIFY_TOKEN_KEY: KEY.toString("base64") }).equals(KEY)).toBe(true);
  });
});
