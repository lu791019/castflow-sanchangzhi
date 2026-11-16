/**
 * 品味資料存取（server only，走 service role；一律帶 userId 過濾）。
 * - taste_profiles：問卷前兩題（migration 028）
 * - 挑 3 部：存在既有 settings 表（每人一列，picks.ts）；不寫日誌——沒有真的日期，
 *   寫進去會出現假日期、月曆與「現在想說說嗎？」提醒（UX-15）
 * - ⑤演出想看哪種（Q-63）：也存在 settings 表（每人一列，live-kinds.ts）；④縣市直接寫散場之前的縣市（before/city-repository.ts）
 * - 行為足跡：日誌、自己公開發佈的文章、句邊畫記
 */

import type { Venue } from "@/lib/journal/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkKind } from "@/lib/works/format";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import { parseStoredLiveKinds, tasteLiveKey } from "./live-kinds";
import { mergeTastePicks, parseStoredPicks, tastePicksKey, type StoredTastePick } from "./picks";
import type { TastePick } from "./questionnaire";
import { isMediaKey, isTasteSetting, type Questionnaire, type TasteInputs } from "./types";

/** 行為足跡只看最近這麼多筆，夠排序也夠配對 */
const BEHAVIOR_LIMIT = 500;

type KindJoin = { kind: WorkKind } | Array<{ kind: WorkKind }> | null;

function kindOf(join: KindJoin): WorkKind | null {
  if (!join) return null;
  return Array.isArray(join) ? (join[0]?.kind ?? null) : join.kind;
}

export async function loadQuestionnaire(userId: string): Promise<Questionnaire | null> {
  const { data, error } = await createAdminClient()
    .from("taste_profiles")
    .select("media, setting")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`讀取品味問卷失敗：${error.message}`);
  if (!data) return null;
  const row = data as { media: unknown[] | null; setting: unknown };
  return {
    media: (row.media ?? []).filter(isMediaKey),
    setting: isTasteSetting(row.setting) ? row.setting : null,
  };
}

export async function saveQuestionnaire(userId: string, questionnaire: Questionnaire): Promise<void> {
  const { error } = await createAdminClient().from("taste_profiles").upsert({
    user_id: userId,
    media: questionnaire.media,
    setting: questionnaire.setting,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`儲存品味問卷失敗：${error.message}`);
}

/** 只接受真的存在的作品（選擇面板建立或取回的 works 列）：id → kind */
async function existingWorkKinds(workIds: readonly string[]): Promise<Map<string, WorkKind>> {
  if (workIds.length === 0) return new Map();
  const { data, error } = await createAdminClient().from("works").select("id, kind").in("id", [...workIds]);
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  return new Map(((data ?? []) as Array<{ id: string; kind: WorkKind }>).map((row) => [row.id, row.kind]));
}

async function loadStoredPicks(userId: string): Promise<StoredTastePick[]> {
  const { data, error } = await createAdminClient().from("settings").select("value").eq("key", tastePicksKey(userId)).maybeSingle();
  if (error) throw new Error(`讀取挑過的作品失敗：${error.message}`);
  return parseStoredPicks(data?.value);
}

/** 挑的作品存成品味資料（找不到的作品略過）；回傳實際存下幾部 */
export async function saveTastePicks(userId: string, picks: readonly TastePick[], now: Date): Promise<number> {
  if (picks.length === 0) return 0;
  const [known, existing] = await Promise.all([existingWorkKinds(picks.map((pick) => pick.workId)), loadStoredPicks(userId)]);
  const valid = picks.filter((pick) => known.has(pick.workId));
  if (valid.length === 0) return 0;
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: tastePicksKey(userId), value: { picks: mergeTastePicks(existing, valid, now) }, updated_at: now.toISOString() });
  if (error) throw new Error(`儲存挑過的作品失敗：${error.message}`);
  return valid.length;
}

export async function loadTasteLiveKinds(userId: string): Promise<LiveSubcategory[]> {
  const { data, error } = await createAdminClient().from("settings").select("value").eq("key", tasteLiveKey(userId)).maybeSingle();
  if (error) throw new Error(`讀取演出種類失敗：${error.message}`);
  return parseStoredLiveKinds(data?.value);
}

/** ⑤重答就整個換掉（不合併）：這題是「現在想看哪種」 */
export async function saveTasteLiveKinds(userId: string, kinds: readonly LiveSubcategory[], now: Date): Promise<void> {
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: tasteLiveKey(userId), value: { kinds }, updated_at: now.toISOString() });
  if (error) throw new Error(`儲存演出種類失敗：${error.message}`);
}

async function loadPicks(userId: string): Promise<NonNullable<TasteInputs["picks"]>> {
  const stored = await loadStoredPicks(userId);
  const kinds = await existingWorkKinds(stored.map((pick) => pick.workId));
  return stored.flatMap((pick) => {
    const kind = kinds.get(pick.workId);
    return kind ? [{ workId: pick.workId, kind, seen: pick.seen }] : [];
  });
}

async function loadJournals(userId: string): Promise<TasteInputs["journals"]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("work_id, venue, works(kind)")
    .eq("user_id", userId)
    .neq("status", "skipped")
    .order("experienced_at", { ascending: false })
    .limit(BEHAVIOR_LIMIT);
  if (error) throw new Error(`讀取日誌失敗：${error.message}`);
  return ((data ?? []) as unknown as Array<{ work_id: string | null; venue: Venue; works: KindJoin }>).map((row) => ({
    workId: row.work_id,
    kind: kindOf(row.works),
    venue: row.venue,
  }));
}

async function loadPublishedWorks(userId: string): Promise<TasteInputs["publishedWorks"]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("work_id, works(kind)")
    .eq("user_id", userId)
    .not("published_at", "is", null)
    .not("work_id", "is", null)
    .neq("source", "rss")
    .order("published_at", { ascending: false })
    .limit(BEHAVIOR_LIMIT);
  if (error) throw new Error(`讀取已發佈文章失敗：${error.message}`);
  return ((data ?? []) as unknown as Array<{ work_id: string; works: KindJoin }>).flatMap((row) => {
    const kind = kindOf(row.works);
    return kind ? [{ workId: row.work_id, kind }] : [];
  });
}

async function loadMarks(userId: string): Promise<TasteInputs["marks"]> {
  const { data, error } = await createAdminClient()
    .from("passage_resonances")
    .select("episode_id, passage_hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(BEHAVIOR_LIMIT);
  if (error) throw new Error(`讀取畫記失敗：${error.message}`);
  return ((data ?? []) as Array<{ episode_id: string; passage_hash: string }>).map((row) => ({
    episodeId: row.episode_id,
    passageHash: row.passage_hash,
  }));
}

export async function loadTasteInputs(userId: string): Promise<TasteInputs> {
  const [journals, publishedWorks, marks, questionnaire, picks, liveKinds] = await Promise.all([
    loadJournals(userId),
    loadPublishedWorks(userId),
    loadMarks(userId),
    loadQuestionnaire(userId),
    loadPicks(userId),
    loadTasteLiveKinds(userId),
  ]);
  return { journals, publishedWorks, marks, questionnaire, picks, liveKinds };
}
