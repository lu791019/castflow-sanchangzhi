/**
 * 印文用字的讀寫（server only，service role）。
 * 顯示印章的地方一律帶 glyph：<Seal penName glyph={…} />。
 * - 依 user id：loadSealGlyph / loadSealGlyphs（自己的頁面、文章作者）
 * - 依筆名：loadSealGlyphByPenName / loadSealGlyphsByPenNames（作者專欄頁、同場、來函署名）
 * 讀出的字已不在筆名裡（改過筆名）時回 null，交回規則。
 */

import { isUuid } from "@/lib/auth/owned-reads";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSealGlyph, resolveGlyph, type GlyphResult } from "./glyph";

interface GlyphRow {
  id: string;
  pen_name: string | null;
  seal_glyph: string | null;
}

const COLUMNS = "id, pen_name, seal_glyph";

function glyphOf(row: GlyphRow): string | null {
  return row.pen_name ? resolveGlyph(row.seal_glyph, row.pen_name) : null;
}

/** 讀取失敗不擋畫面：記 log、回空（印章退回規則字） */
async function selectRows(column: "id" | "pen_name", values: readonly string[]): Promise<GlyphRow[]> {
  if (values.length === 0) return [];
  const { data, error } = await createAdminClient().from("profiles").select(COLUMNS).in(column, values);
  if (error) {
    console.error("[seal] load glyphs failed", { column, message: error.message });
    return [];
  }
  return (data ?? []) as GlyphRow[];
}

export async function loadSealGlyphs(userIds: readonly string[]): Promise<Map<string, string | null>> {
  const rows = await selectRows("id", [...new Set(userIds)].filter(isUuid));
  return new Map(rows.map((row) => [row.id, glyphOf(row)]));
}

export async function loadSealGlyph(userId: string): Promise<string | null> {
  return (await loadSealGlyphs([userId])).get(userId) ?? null;
}

export async function loadSealGlyphsByPenNames(penNames: readonly string[]): Promise<Map<string, string | null>> {
  const rows = await selectRows("pen_name", [...new Set(penNames)].filter(Boolean));
  return new Map(rows.flatMap((row) => (row.pen_name ? [[row.pen_name, glyphOf(row)] as const] : [])));
}

export async function loadSealGlyphByPenName(penName: string): Promise<string | null> {
  return (await loadSealGlyphsByPenNames([penName])).get(penName) ?? null;
}

/** 設定頁存印文：以 DB 裡目前的筆名驗證（不信任 client 傳來的筆名）；null＝回到依規則 */
export async function saveSealGlyph(userId: string, value: unknown): Promise<GlyphResult> {
  if (!isUuid(userId)) return { ok: false, error: "請先登入" };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("profiles").select("pen_name").eq("id", userId).maybeSingle();
  if (error) throw new Error(`讀取筆名失敗：${error.message}`);
  const penName = (data?.pen_name as string | null | undefined) ?? "";
  const parsed = parseSealGlyph(value, penName);
  if (!parsed.ok) return parsed;
  const { error: updateError } = await supabase.from("profiles").update({ seal_glyph: parsed.value }).eq("id", userId);
  if (updateError) throw new Error(`儲存印文失敗：${updateError.message}`);
  return parsed;
}
