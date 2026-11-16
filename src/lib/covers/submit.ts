/**
 * 讀者補封面的共用流程（Q-45／Q-46，依賴注入、純邏輯可測）：場刊「補封面」與記一筆場外「封面」列都走這裡。
 * - 自家桶網址（上傳後拿到的）→ source=upload → 一律待審。
 * - 外部網址 → 驗網址（SSRF）→ server 下載驗檔頭 → 轉存自家桶 → 原址與每一跳都在白名單才通過，否則待審。
 * - 通過 → 只補空的 works.poster_url；待審 → 推警報（work、user、網址），不寫 poster_url。
 * 接線在 submit-service.ts。
 */

import { decideCoverStatus, type CoverReviewStatus, type CoverSource } from "./allowlist";
import type { DownloadedCover } from "./fetch-remote";
import { parseRemoteCoverUrl } from "./remote-url";
import type { CoverFileType } from "./upload";

export interface CoverSubmissionRow {
  workId: string;
  userId: string;
  url: string;
  source: CoverSource;
  status: CoverReviewStatus;
}

export interface CoverSubmitDeps {
  /** 自家 covers 桶公開網址前綴 */
  ownPrefix: string | null;
  download: (url: URL) => Promise<DownloadedCover>;
  store: (bytes: Uint8Array, type: CoverFileType) => Promise<string>;
  insertSubmission: (row: CoverSubmissionRow) => Promise<string>;
  /** 只補空的；回傳有沒有真的寫進去 */
  fillEmptyPoster: (workId: string, url: string) => Promise<boolean>;
  warn: (title: string, detail: string) => void;
}

export interface CoverSubmitInput {
  workId: string;
  userId: string;
  /** 已通過 parseCoverUrl 的網址（外部 https，或自家桶） */
  url: string;
}

export type CoverSubmitResult =
  | { ok: true; status: "approved"; submissionId: string; posterUrl: string | null }
  | { ok: true; status: "pending"; submissionId: string }
  | { ok: false; reason: "invalid" | "fetch_failed"; error: string };

type Prepared = { ok: true; url: string; source: CoverSource; hosts: string[] } | Extract<CoverSubmitResult, { ok: false }>;

async function prepare(deps: CoverSubmitDeps, input: CoverSubmitInput): Promise<Prepared> {
  if (deps.ownPrefix && input.url.startsWith(deps.ownPrefix)) {
    return { ok: true, url: input.url, source: "upload", hosts: [] };
  }
  const parsed = parseRemoteCoverUrl(input.url);
  if (!parsed.ok) return { ok: false, reason: "invalid", error: parsed.error };
  let downloaded: DownloadedCover;
  try {
    downloaded = await deps.download(parsed.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.warn("場刊封面下載失敗", `work=${input.workId} user=${input.userId} url=${input.url} ${message}`);
    return { ok: false, reason: "fetch_failed", error: "這張圖抓不下來，換一張或直接上傳" };
  }
  const stored = await deps.store(downloaded.bytes, downloaded.type);
  return { ok: true, url: stored, source: "url", hosts: downloaded.hosts };
}

export async function submitCover(deps: CoverSubmitDeps, input: CoverSubmitInput): Promise<CoverSubmitResult> {
  const prepared = await prepare(deps, input);
  if (!prepared.ok) return prepared;
  const status = decideCoverStatus({ source: prepared.source, hosts: prepared.hosts });
  const submissionId = await deps.insertSubmission({
    workId: input.workId,
    userId: input.userId,
    url: prepared.url,
    source: prepared.source,
    status,
  });
  if (status === "pending") {
    deps.warn(
      "有人補了白名單外的封面，待審",
      `work=${input.workId} user=${input.userId} url=${input.url} stored=${prepared.url} source=${prepared.source} id=${submissionId}`,
    );
    return { ok: true, status, submissionId };
  }
  const written = await deps.fillEmptyPoster(input.workId, prepared.url);
  return { ok: true, status, submissionId, posterUrl: written ? prepared.url : null };
}
