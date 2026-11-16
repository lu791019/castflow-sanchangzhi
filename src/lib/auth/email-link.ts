/**
 * 登入信連結回跳（/auth/callback）的參數判讀（純函式）。
 * 新版信：連結直接指向本站，帶 token_hash（verifyOtp），哪個瀏覽器、哪個 app 打開都能登入；
 * 舊版信（10/15 前寄出、1 小時內仍有效）：經 Supabase 轉回來帶 PKCE code，只能在寄信的那個瀏覽器換 session。
 */

export const EMAIL_LINK_TYPES = ["email", "magiclink", "signup"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

export type EmailLink =
  | { kind: "otp"; tokenHash: string; type: EmailLinkType }
  | { kind: "code"; code: string }
  | { kind: "none" };

const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

function isEmailLinkType(value: string): value is EmailLinkType {
  return (EMAIL_LINK_TYPES as readonly string[]).includes(value);
}

export function parseEmailLink(params: URLSearchParams): EmailLink {
  const tokenHash = params.get("token_hash");
  if (tokenHash !== null) {
    const type = params.get("type") ?? "email";
    if (!TOKEN_HASH_PATTERN.test(tokenHash) || !isEmailLinkType(type)) return { kind: "none" };
    return { kind: "otp", tokenHash, type };
  }
  const code = params.get("code");
  return code ? { kind: "code", code } : { kind: "none" };
}
