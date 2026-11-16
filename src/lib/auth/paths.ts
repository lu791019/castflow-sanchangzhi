/**
 * 哪些頁面需要登入（純函式，proxy 與測試共用）。
 * 產品原則「不用先註冊，先說一段再說」：瀏覽（首頁目錄、分享頁、作品特輯、單集閱讀頁）一律公開；
 * 說一段頁本身公開（先說後登入：送出時才要求登入，草稿見 lib/say/draft）；
 * 寫入與個人資料（散場之前、校樣、我的、設定、日誌、通知、編輯檯）才要登入。
 */

const PROTECTED_PREFIXES = [
  "/before",
  "/proof",
  "/me",
  "/settings",
  "/journal",
  "/notifications",
  "/onboarding",
  "/dashboard",
  "/episodes",
  "/schedule",
  "/styles",
] as const;

/** /episodes/<id>/read 是公開的單集閱讀頁 */
const PUBLIC_EPISODE_READ = /^\/episodes\/[^/]+\/read\/?$/;

const PEN_NAME_EXEMPT_PREFIXES = ["/onboarding"] as const;

/** 不能當登入後去處的路徑（避免繞圈） */
const NEXT_BLOCKED_PREFIXES = ["/login", "/auth"] as const;

export const DEFAULT_AFTER_LOGIN = "/before";
export const PEN_NAME_PATH = "/onboarding/pen-name";
export const TASTE_PATH = "/onboarding/taste";

/** 第一次取完筆名 → 品味問卷（可跳過），答完再去原本要去的地方 */
export function tasteOnboardingPath(next: string): string {
  return `${TASTE_PATH}?next=${encodeURIComponent(safeNextPath(next))}`;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPage(pathname: string): boolean {
  if (PUBLIC_EPISODE_READ.test(pathname)) return false;
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isPenNameExemptPath(pathname: string): boolean {
  return PEN_NAME_EXEMPT_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** 只接受站內絕對路徑，擋 open redirect（//host、/\host、完整 URL） */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  const pathname = value.split(/[?#]/)[0];
  if (NEXT_BLOCKED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return fallback;
  return value;
}

export function loginRedirectPath(pathname: string, search: string): string {
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}
