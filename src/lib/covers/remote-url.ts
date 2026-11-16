/**
 * 外部封面網址的 SSRF 防線（Q-45，純函式）：只收 https、預設埠、不帶帳密；
 * 擋 localhost、.local／.internal、私有網段／迴路／link-local 的 IP 字面；轉址每一跳都重驗。
 * DNS 解析後的位址另由 fetch-remote.ts 的 lookup 再以 isPrivateAddress 檢查（防 DNS 指向內網）。
 */

import { isIP } from "node:net";
import { COVER_URL_MAX_LENGTH } from "./upload";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

/** IPv4 不可連的網段：[網段起點, 前綴長度] */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function v4ToNumber(ip: string): number {
  return ip.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

function inV4Range(ip: string, base: string, prefix: number): boolean {
  const size = 2 ** (32 - prefix);
  return Math.floor(v4ToNumber(ip) / size) === Math.floor(v4ToNumber(base) / size);
}

function isPrivateV4(ip: string): boolean {
  return BLOCKED_V4.some(([base, prefix]) => inV4Range(ip, base, prefix));
}

/** IPv4 寫法轉成兩組 16 位元十六進位（給 IPv6 結尾的 a.b.c.d 用） */
function v4AsV6Groups(ip: string): string[] {
  const n = v4ToNumber(ip);
  return [Math.floor(n / 65536).toString(16), (n % 65536).toString(16)];
}

/** IPv6 展開成 8 組 16 位元（支援 :: 與結尾的 IPv4 寫法）；格式不對回 null */
function expandV6(ip: string): number[] | null {
  const lower = ip.toLowerCase().split("%")[0];
  const v4Tail = lower.match(/(\d+\.\d+\.\d+\.\d+)$/);
  const body = v4Tail ? lower.slice(0, -v4Tail[1].length) : lower;
  const split = (text: string) => text.split(":").filter(Boolean);
  const v4Groups = v4Tail ? v4AsV6Groups(v4Tail[1]) : [];
  const [head, tail] = body.includes("::") ? body.split("::") : [body, null];
  const headParts = split(head);
  const tailParts = [...(tail === null ? [] : split(tail)), ...v4Groups];
  const parts =
    tail === null
      ? [...headParts, ...v4Groups]
      : [...headParts, ...Array<string>(Math.max(8 - headParts.length - tailParts.length, 0)).fill("0"), ...tailParts];
  return parts.length === 8 ? parts.map((part) => parseInt(part, 16)) : null;
}

function isPrivateV6(ip: string): boolean {
  const groups = expandV6(ip);
  if (!groups) return true;
  const [first] = groups;
  const zeroPrefix = groups.slice(0, 5).every((group) => group === 0);
  // IPv4 對映（::ffff:a.b.c.d）與舊式 IPv4 相容（::a.b.c.d）→ 照 IPv4 判斷
  if (zeroPrefix && (groups[5] === 0xffff || groups[5] === 0) && !(groups[5] === 0 && groups[6] === 0)) {
    const v4 = [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join(".");
    return isPrivateV4(v4);
  }
  if (groups.every((group, index) => (index === 7 ? group <= 1 : group === 0))) return true; // :: 與 ::1
  if ((first & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/** 位址是否不可連；不是合法 IP 的字串一律當危險 */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip.split("%")[0]);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) return isPrivateV6(ip);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host || host === "localhost") return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return isIP(host) !== 0 && isPrivateAddress(host);
}

/** 錯誤訊息裡的稱呼：封面與文章匯入各自一組 */
export interface RemoteUrlLabels {
  noun: string;
  blocked: string;
}

const COVER_LABELS: RemoteUrlLabels = { noun: "封面網址", blocked: "這個網址抓不到圖" };

/**
 * 外部網址的共同檢查（封面與文章匯入共用；轉址每一跳也走這裡）。
 * labels 只影響錯誤訊息，規則完全相同。
 */
export function checkRemoteUrl(url: URL, labels: RemoteUrlLabels = COVER_LABELS): Result<URL> {
  if (url.protocol !== "https:") return { ok: false, error: `${labels.noun}要是 https 開頭` };
  if (url.username || url.password) return { ok: false, error: `${labels.noun}不能帶帳號密碼` };
  if (url.port && url.port !== "443") return { ok: false, error: `${labels.noun}不收特殊連接埠` };
  if (isBlockedHostname(url.hostname)) return { ok: false, error: labels.blocked };
  return { ok: true, value: url };
}

const checkUrl = (url: URL): Result<URL> => checkRemoteUrl(url);

export function parseRemoteCoverUrl(value: string): Result<URL> {
  const trimmed = value.trim();
  if (trimmed.length > COVER_URL_MAX_LENGTH) return { ok: false, error: `封面網址不可超過 ${COVER_URL_MAX_LENGTH} 字` };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "封面網址格式不對" };
  }
  return checkUrl(url);
}

/** 轉址：Location 以目前網址為基準解析，再走一次同樣的檢查 */
export function nextRedirectUrl(current: URL, location: string | null | undefined): Result<URL> {
  if (!location) return { ok: false, error: "轉址沒有目的地" };
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    return { ok: false, error: "轉址格式不對" };
  }
  return next.href.length > COVER_URL_MAX_LENGTH ? { ok: false, error: "轉址太長" } : checkUrl(next);
}
