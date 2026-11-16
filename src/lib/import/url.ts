/**
 * 文章網址正規化（純函式）：同一篇不同寫法要得到同一個鍵，才能判斷「已經搬過了」。
 * - 沒寫協定補 https；http 一律升 https（抓取只走 https）
 * - host 小寫、去預設埠、去 #、去追蹤參數（utm_*、fbclid…）、其餘 query 排序、路徑結尾斜線拿掉（根目錄除外）
 * - 安全檢查沿用封面的 SSRF 防線（checkRemoteUrl），只換錯誤訊息的稱呼
 */

import { checkRemoteUrl, type RemoteUrlLabels } from "@/lib/covers/remote-url";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ARTICLE_URL_MAX_LENGTH = 2000;

export const ARTICLE_URL_LABELS: RemoteUrlLabels = { noun: "文章網址", blocked: "這個網址抓不到文章" };

const TRACKING_PARAMS = new Set(["fbclid", "gclid", "dclid", "msclkid", "igshid", "mc_cid", "mc_eid", "ref_src", "_ga"]);

/** 一般網域（IDN 已被 URL 轉成 xn--）；至少要有一個點 */
const HOSTNAME_PATTERN = /^(?=.*\.)[a-z0-9-]+(\.[a-z0-9-]+)+\.?$/i;

function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase();
  return key.startsWith("utm_") || TRACKING_PARAMS.has(key);
}

function withScheme(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

function cleanQuery(params: URLSearchParams): string {
  const kept = [...params.entries()].filter(([name]) => !isTrackingParam(name));
  const sorted = [...kept].sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  return new URLSearchParams(sorted).toString();
}

export function normalizeArticleUrl(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "請貼上文章網址" };
  if (trimmed.length > ARTICLE_URL_MAX_LENGTH) return { ok: false, error: "文章網址太長了" };
  let url: URL;
  try {
    url = new URL(withScheme(trimmed));
  } catch {
    return { ok: false, error: "網址格式不對" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "請貼 https 開頭的文章網址" };
  const upgraded = new URL(url.href.replace(/^http:/i, "https:"));
  const checked = checkRemoteUrl(upgraded, ARTICLE_URL_LABELS);
  if (!checked.ok) return checked;
  if (!HOSTNAME_PATTERN.test(upgraded.hostname)) return { ok: false, error: "網址格式不對" };

  const query = cleanQuery(upgraded.searchParams);
  const path = upgraded.pathname.length > 1 ? upgraded.pathname.replace(/\/+$/, "") : "/";
  const port = upgraded.port && upgraded.port !== "443" ? `:${upgraded.port}` : "";
  const value = `https://${upgraded.hostname.toLowerCase()}${port}${path || "/"}${query ? `?${query}` : ""}`;
  return value.length > ARTICLE_URL_MAX_LENGTH ? { ok: false, error: "文章網址太長了" } : { ok: true, value };
}

/** 「原文刊於〈網域〉」：去掉 www.；格式錯回 null */
export function displayDomain(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
