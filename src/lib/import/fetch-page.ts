/**
 * 下載文章網頁（server only）：走封面同一套 SSRF 防線（fetchRemote：https、DNS 擋內網、轉址每跳重驗），
 * 文章版的上限是 10 秒、2MB，只收 HTML。
 *
 * E2E 不能打真的外部網站：設 IMPORT_E2E_FIXTURES=<目錄> 時改讀本地 fixture（只在非 production 生效），
 * 網址 https://<host>/<path> 對應 <目錄>/<host>/<path>.html；LLM 回覆放同名 .llm.txt（見 server.ts）。
 */

import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fetchRemote, type RemoteFetchOptions } from "@/lib/covers/fetch-remote";
import { decodeHtml, isHtmlContentType } from "./decode";

export const IMPORT_FETCH: RemoteFetchOptions = {
  maxBytes: 2 * 1024 * 1024,
  timeoutMs: 10_000,
  accept: "text/html,application/xhtml+xml",
  userAgent: "Mozilla/5.0 (compatible; SanchangImporter/1.0)",
  timeoutMessage: "抓取文章逾時（10 秒）",
};

export interface FetchedPage {
  html: string;
  /** 轉址後的最終網址（相對路徑首圖以此為基準） */
  finalUrl: string;
}

export type PageFetcher = (url: URL) => Promise<FetchedPage>;

/** 抓到了但不是網頁：給使用者看得懂的訊息，不當成上游故障 */
export class NotHtmlError extends Error {
  constructor() {
    super("這個網址不是網頁文章");
    this.name = "NotHtmlError";
  }
}

export const fetchArticlePage: PageFetcher = async (url) => {
  const response = await fetchRemote(url, IMPORT_FETCH);
  if (!isHtmlContentType(response.contentType)) throw new NotHtmlError();
  return { html: decodeHtml(response.bytes, response.contentType), finalUrl: response.finalUrl.href };
};

/** E2E fixture 的檔案路徑（不含副檔名）；路徑段只收安全字元，擋 ..／跳出目錄 */
export function fixtureBasePath(dir: string, url: URL): string | null {
  const segments = [url.hostname, ...url.pathname.split("/").filter(Boolean)];
  if (segments.some((segment) => !/^[\w.@-]+$/.test(segment) || segment === ".." || segment === ".")) return null;
  const root = resolve(dir);
  const base = resolve(join(root, ...(segments.length === 1 ? [...segments, "index"] : segments)));
  return base.startsWith(`${root}${sep}`) ? base : null;
}

export function fixturePageFetcher(dir: string): PageFetcher {
  return async (url) => {
    const base = fixtureBasePath(dir, url);
    if (!base) throw new Error("來源回應 404");
    try {
      return { html: await readFile(`${base}.html`, "utf8"), finalUrl: url.href };
    } catch {
      throw new Error("來源回應 404");
    }
  };
}
