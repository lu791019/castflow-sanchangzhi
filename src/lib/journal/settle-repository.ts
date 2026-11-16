/**
 * 散場當下提醒的資料讀取（server only，service role；worker 經 /api/journal/due 取用）。
 * 撈近 36 小時的計畫 → 排除已建過 settle_prompt 的、同天已說過同作品的 → settle-due 組文案。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { DueReminder } from "./due";
import { buildSettlePrompts, isPlannedAhead, type SaidMark, type SettleCandidateRow } from "./settle-due";
import { HOUR_MS } from "./time";

/** 最晚的情況：深夜散場（場次＋片長）→ 隔天 09:00＋12 小時寬限，36 小時足夠涵蓋 */
const SETTLE_LOOKBACK_MS = 36 * HOUR_MS;
/** 說過的痕跡往前看兩天（同一個邏輯日比對即可） */
const SAID_LOOKBACK_MS = 48 * HOUR_MS;
const SETTLE_BATCH_LIMIT = 200;

const SETTLE_SELECT =
  "id, user_id, work_id, experienced_at, created_at, venue, status, episode_id, work_title_fallback, works(title, kind, podcast_show, runtime_minutes)";

type Client = ReturnType<typeof createAdminClient>;

async function listCandidates(client: Client, now: Date): Promise<SettleCandidateRow[]> {
  const { data, error } = await client
    .from("journal_entries")
    .select(SETTLE_SELECT)
    .in("status", ["planned", "recorded"])
    .is("episode_id", null)
    .gte("experienced_at", new Date(now.getTime() - SETTLE_LOOKBACK_MS).toISOString())
    .lte("experienced_at", now.toISOString())
    .order("experienced_at", { ascending: true })
    .limit(SETTLE_BATCH_LIMIT);
  if (error) throw new Error(`讀取散場候選失敗：${error.message}`);
  return ((data ?? []) as unknown as SettleCandidateRow[]).filter(isPlannedAhead);
}

async function listNotified(client: Client, entryIds: readonly string[]): Promise<Set<string>> {
  const { data, error } = await client
    .from("notifications")
    .select("journal_entry_id")
    .eq("kind", "settle_prompt")
    .in("journal_entry_id", [...entryIds]);
  if (error) throw new Error(`讀取已建散場提醒失敗：${error.message}`);
  return new Set((data ?? []).map((row) => (row as { journal_entry_id: string }).journal_entry_id));
}

async function listSaidMarks(client: Client, userIds: readonly string[], now: Date): Promise<SaidMark[]> {
  const since = new Date(now.getTime() - SAID_LOOKBACK_MS).toISOString();
  const [journals, episodes] = await Promise.all([
    client
      .from("journal_entries")
      .select("user_id, work_id, work_title_fallback, experienced_at")
      .in("user_id", [...userIds])
      .not("episode_id", "is", null)
      .gte("experienced_at", since),
    client
      .from("episodes")
      .select("user_id, work_id, created_at")
      .in("user_id", [...userIds])
      .not("work_id", "is", null)
      .gte("created_at", since),
  ]);
  if (journals.error) throw new Error(`讀取同天已說過的紀錄失敗：${journals.error.message}`);
  if (episodes.error) throw new Error(`讀取同天已寫的文章失敗：${episodes.error.message}`);
  const fromJournals = (journals.data ?? []).map((row) => {
    const r = row as { user_id: string; work_id: string | null; work_title_fallback: string | null; experienced_at: string };
    return { userId: r.user_id, workId: r.work_id, titleFallback: r.work_title_fallback, at: r.experienced_at };
  });
  const fromEpisodes = (episodes.data ?? []).map((row) => {
    const r = row as { user_id: string; work_id: string; created_at: string };
    return { userId: r.user_id, workId: r.work_id, at: r.created_at };
  });
  return [...fromJournals, ...fromEpisodes];
}

/** worker 用（x-api-key）：到點的散場提醒（每條目只會出現到建好通知為止） */
export async function listDueSettlePrompts(now: Date = new Date()): Promise<DueReminder[]> {
  const client = createAdminClient();
  const candidates = await listCandidates(client, now);
  if (candidates.length === 0) return [];
  const [notified, said] = await Promise.all([
    listNotified(client, candidates.map((row) => row.id)),
    listSaidMarks(client, [...new Set(candidates.map((row) => row.user_id))], now),
  ]);
  return buildSettlePrompts(candidates, { notified, said }, now);
}
