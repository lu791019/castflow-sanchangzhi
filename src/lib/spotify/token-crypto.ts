/**
 * Spotify refresh token 加密（Q-64 C1）：AES-256-GCM，金鑰 env SPOTIFY_TOKEN_KEY（32 bytes 的 base64）。
 * 格式 v1:<iv>:<tag>:<密文>（皆 base64url）；AAD＝user_id，密文搬到別人的列就解不開。
 * DB 只存密文；web（OAuth callback 寫入）與本機 worker（拉收聽紀錄時解開）共用：只用相對路徑 import。
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class TokenKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenKeyError";
  }
}

type Env = Readonly<Record<string, string | undefined>>;

/** SPOTIFY_TOKEN_KEY：`openssl rand -base64 32` 產生；沒設或長度不對丟 TokenKeyError（不印金鑰） */
export function tokenKeyFromEnv(env: Env = process.env): Buffer {
  const raw = env.SPOTIFY_TOKEN_KEY?.trim();
  if (!raw) throw new TokenKeyError("沒有 SPOTIFY_TOKEN_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) throw new TokenKeyError(`SPOTIFY_TOKEN_KEY 要是 ${KEY_BYTES} bytes 的 base64（openssl rand -base64 32）`);
  return key;
}

export function encryptToken(plain: string, userId: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(":");
}

/** 格式錯、金鑰錯、user_id 對不上都丟錯（GCM 驗證失敗） */
export function decryptToken(sealed: string, userId: string, key: Buffer): string {
  const [version, iv, tag, body, ...rest] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || !body || rest.length > 0) throw new Error("refresh token 密文格式不對");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(userId, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
