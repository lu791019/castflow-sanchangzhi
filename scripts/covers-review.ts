/**
 * 待審封面人工審核（Q-46，service role）：
 *   npm run covers:review                     列出待審
 *   npm run covers:review -- --approve <id>   通過：補空的 works.poster_url
 *   npm run covers:review -- --reject <id>    退回：刪掉 covers 桶裡的檔
 * env：repo 根 .env.development.local 優先，再 .env.local；已存在的環境變數不被覆蓋
 * （對雲端審核時先 export NEXT_PUBLIC_SUPABASE_URL／SUPABASE_SERVICE_ROLE_KEY）。不印任何金鑰。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseReviewArgs, reviewCoverSubmission, type ReviewDeps } from "../src/lib/covers/review.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(repoRoot, envFile));
  } catch {
    // 檔案不存在就跳過
  }
}

const BUCKET = "covers";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少環境變數 ${name}`);
  return value;
}

const baseUrl = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const db = createClient(baseUrl, required("SUPABASE_SERVICE_ROLE_KEY"));

const deps: ReviewDeps = {
  publicPrefix: `${baseUrl}/storage/v1/object/public/${BUCKET}/`,
  findPending: async (id) => {
    const { data, error } = await db
      .from("work_cover_submissions")
      .select("id, work_id, url")
      .eq("id", id)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw new Error(`讀取待審封面失敗：${error.message}`);
    return data ? { id: data.id, workId: data.work_id, url: data.url } : null;
  },
  setStatus: async (id, status) => {
    const { error } = await db
      .from("work_cover_submissions")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) throw new Error(`更新審核狀態失敗：${error.message}`);
  },
  fillEmptyPoster: async (workId, url) => {
    const { data, error } = await db.from("works").update({ poster_url: url }).eq("id", workId).is("poster_url", null).select("id");
    if (error) throw new Error(`寫入封面失敗：${error.message}`);
    return (data ?? []).length > 0;
  },
  removeObject: async (objectPath) => {
    const { error } = await db.storage.from(BUCKET).remove([objectPath]);
    if (error) throw new Error(`刪除封面檔失敗：${error.message}`);
  },
};

async function listPending(): Promise<void> {
  const { data, error } = await db
    .from("work_cover_submissions")
    .select("id, source, url, created_at, works(title, slug)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(`讀取待審清單失敗：${error.message}`);
  if (!data || data.length === 0) {
    console.log("沒有待審的封面。");
    return;
  }
  for (const row of data) {
    const work = row.works as unknown as { title: string; slug: string } | null;
    console.log(`${row.id}  ${row.created_at}  ${row.source}  《${work?.title ?? "?"}》 /works/${work?.slug ?? "?"}\n    ${row.url}`);
  }
}

async function main(): Promise<void> {
  const parsed = parseReviewArgs(process.argv.slice(2));
  if (!parsed.ok) throw new Error(parsed.error);
  const command = parsed.value;
  if (command.action === "list") return listPending();
  const result = await reviewCoverSubmission(deps, command.action, command.id);
  console.log(result.message);
  if (!result.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`[covers:review] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
