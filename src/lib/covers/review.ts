/**
 * 待審封面的人工審核（Q-46，依賴注入、不 import 任何東西：scripts/covers-review.ts 以 node 直接載入）。
 * approve → status approved＋只補空的 works.poster_url；reject → status rejected＋刪掉 covers 桶裡的檔。
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type ReviewCommand = { action: "list" } | { action: "approve" | "reject"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REVIEW_USAGE = "用法：npm run covers:review -- [--list] | --approve <id> | --reject <id>";

export function parseReviewArgs(args: readonly string[]): Result<ReviewCommand> {
  if (args.length === 0 || (args.length === 1 && args[0] === "--list")) return { ok: true, value: { action: "list" } };
  const [flag, id] = args;
  const action = flag === "--approve" ? "approve" : flag === "--reject" ? "reject" : null;
  if (!action || args.length !== 2) return { ok: false, error: REVIEW_USAGE };
  if (!UUID.test(id)) return { ok: false, error: `id 要是 uuid：${id}` };
  return { ok: true, value: { action, id } };
}

/** 自家桶公開網址 → 桶內路徑（只認 prefix 底下、不含 ..） */
export function storagePathOf(url: string, prefix: string): string | null {
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return path && !path.split("/").includes("..") ? path : null;
}

export interface PendingCoverRow {
  id: string;
  workId: string;
  url: string;
}

export interface ReviewDeps {
  findPending: (id: string) => Promise<PendingCoverRow | null>;
  setStatus: (id: string, status: "approved" | "rejected") => Promise<void>;
  fillEmptyPoster: (workId: string, url: string) => Promise<boolean>;
  removeObject: (path: string) => Promise<void>;
  publicPrefix: string;
}

export async function reviewCoverSubmission(
  deps: ReviewDeps,
  action: "approve" | "reject",
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const row = await deps.findPending(id);
  if (!row) return { ok: false, message: `找不到待審的封面 ${id}` };
  if (action === "approve") {
    await deps.setStatus(id, "approved");
    const written = await deps.fillEmptyPoster(row.workId, row.url);
    return { ok: true, message: written ? "已通過，場刊封面已換上" : "已通過；場刊已有封面，未覆蓋" };
  }
  await deps.setStatus(id, "rejected");
  const path = storagePathOf(row.url, deps.publicPrefix);
  if (path) await deps.removeObject(path);
  return { ok: true, message: path ? "已退回，並刪掉上傳的檔" : "已退回" };
}
