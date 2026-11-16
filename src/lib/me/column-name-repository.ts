/**
 * 作者專欄名的讀寫（server only，service role）。
 * - 依 user id：loadColumnName（自己的頁面：設定、我的、日誌、來信）
 * - 依筆名：loadColumnNamesByPenNames（索引作者列、搜尋作者列、作者專欄頁；呼叫端只傳有公開署名文章的筆名）
 * 讀取失敗不擋畫面：記 log、當沒取（不顯示那一行）。
 */

import { isUuid } from "@/lib/auth/owned-reads";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseColumnName, resolveColumnName, type ColumnNameResult } from "./column-name";

export async function loadColumnName(userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;
  const { data, error } = await createAdminClient().from("profiles").select("column_name").eq("id", userId).maybeSingle();
  if (error) {
    console.error("[me] loadColumnName failed", { message: error.message });
    return null;
  }
  return resolveColumnName(data?.column_name as string | null | undefined);
}

/** 筆名 → 專欄名；沒取的不放進 Map */
export async function loadColumnNamesByPenNames(penNames: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(penNames)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await createAdminClient().from("profiles").select("pen_name, column_name").in("pen_name", unique);
  if (error) {
    console.error("[me] loadColumnNames failed", { message: error.message });
    return new Map();
  }
  return new Map(
    ((data ?? []) as Array<{ pen_name: string | null; column_name: string | null }>).flatMap((row) => {
      const columnName = resolveColumnName(row.column_name);
      return row.pen_name && columnName ? [[row.pen_name, columnName] as const] : [];
    }),
  );
}

/** 設定頁存專欄名：userId 由 server session 取得；null／空字串＝清掉 */
export async function saveColumnName(userId: string, value: unknown): Promise<ColumnNameResult> {
  if (!isUuid(userId)) return { ok: false, error: "請先登入" };
  const parsed = parseColumnName(value);
  if (!parsed.ok) return parsed;
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ column_name: parsed.value })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`儲存專欄名失敗：${error.message}`);
  // 還沒有 profiles 列（沒取筆名）時 update 不會報錯，只是沒寫進去 → 明講
  if (!data || data.length === 0) return { ok: false, error: "請先取一個筆名" };
  return parsed;
}
