/**
 * 外部下載的 SSRF 防線（Q-45，server only；封面與文章匯入共用 fetchRemote）：
 * 只走 https、逾時（含所有轉址）、轉址最多 3 次且每跳重驗網址、
 * DNS 解析出的每個位址都不可是私網／迴路／link-local（擋 DNS 指向內網）、本體有上限。
 * 封面另外看檔頭判類型（downloadRemoteCover）。任何一關沒過就丟錯，由呼叫端推警報。
 */

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { IncomingMessage } from "node:http";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { isPrivateAddress, nextRedirectUrl } from "./remote-url";
import { COVER_MAX_BYTES, validateCoverUpload, type CoverFileType } from "./upload";

export const REMOTE_COVER_TIMEOUT_MS = 10_000;
export const REMOTE_COVER_MAX_REDIRECTS = 3;

export interface DownloadedCover {
  bytes: Uint8Array;
  type: CoverFileType;
  /** 原址＋每一跳的主機名 */
  hosts: string[];
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** DNS 解析後逐一檢查位址；有任何一個落在內網就整個拒絕 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
      return callback(new Error(`拒絕連往內網位址：${hostname}`), "", 0);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    return callback(null, list[0].address, list[0].family);
  });
};

export interface RemoteFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  accept: string;
  userAgent: string;
  /** 逾時時的錯誤訊息 */
  timeoutMessage: string;
}

export interface RemoteResponse {
  bytes: Uint8Array;
  contentType: string | null;
  /** 原址＋每一跳的主機名 */
  hosts: string[];
  /** 最後一跳的網址 */
  finalUrl: URL;
}

const COVER_FETCH: RemoteFetchOptions = {
  maxBytes: COVER_MAX_BYTES,
  timeoutMs: REMOTE_COVER_TIMEOUT_MS,
  accept: "image/jpeg,image/png,image/webp",
  userAgent: "SanchangCoverFetcher/1.0",
  timeoutMessage: "下載封面逾時",
};

function get(url: URL, signal: AbortSignal, options: RemoteFetchOptions): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: safeLookup,
        signal,
        headers: { "user-agent": options.userAgent, accept: options.accept },
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

function megabytes(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;
}

async function readCapped(response: IncomingMessage, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers["content-length"] ?? "0");
  if (declared > maxBytes) {
    response.destroy();
    throw new Error(`檔案超過 ${megabytes(maxBytes)}（${declared} bytes）`);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response) {
    total += (chunk as Buffer).length;
    if (total > maxBytes) {
      response.destroy();
      throw new Error(`檔案超過 ${megabytes(maxBytes)}`);
    }
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function follow(
  start: URL,
  signal: AbortSignal,
  options: RemoteFetchOptions,
): Promise<{ response: IncomingMessage; hosts: string[]; finalUrl: URL }> {
  let current = start;
  const hosts = [start.hostname];
  for (let hop = 0; ; hop += 1) {
    const response = await get(current, signal, options);
    const status = response.statusCode ?? 0;
    if (!REDIRECT_STATUSES.has(status)) return { response, hosts, finalUrl: current };
    response.resume();
    if (hop >= REMOTE_COVER_MAX_REDIRECTS) throw new Error(`轉址超過 ${REMOTE_COVER_MAX_REDIRECTS} 次`);
    const next = nextRedirectUrl(current, response.headers.location);
    if (!next.ok) throw new Error(`轉址被擋：${next.error}`);
    current = next.value;
    hosts.push(current.hostname);
  }
}

/** start 必須已通過 checkRemoteUrl（封面：parseRemoteCoverUrl）；非 200 或超過上限一律丟錯 */
export async function fetchRemote(start: URL, options: RemoteFetchOptions): Promise<RemoteResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(options.timeoutMessage)), options.timeoutMs);
  try {
    const { response, hosts, finalUrl } = await follow(start, controller.signal, options);
    if (response.statusCode !== 200) {
      response.resume();
      throw new Error(`來源回應 ${response.statusCode}`);
    }
    const bytes = await readCapped(response, options.maxBytes);
    const contentType = response.headers["content-type"] ?? null;
    return { bytes, contentType, hosts, finalUrl };
  } finally {
    clearTimeout(timer);
  }
}

/** start 必須已通過 parseRemoteCoverUrl */
export async function downloadRemoteCover(start: URL): Promise<DownloadedCover> {
  const { bytes, hosts } = await fetchRemote(start, COVER_FETCH);
  const checked = validateCoverUpload(bytes, bytes.length);
  if (!checked.ok) throw new Error(checked.error);
  return { bytes, type: checked.value, hosts };
}
