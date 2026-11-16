/** App 內通知收件匣與 Web Push 訂閱（server only，走 service role；一律帶 userId 過濾） */

import { spotifyListenEnabled } from "@/lib/features";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushSubscriptionInput } from "@/lib/journal/validate";
import type { InboxRow } from "./inbox-row";

export interface AppNotification {
  id: string;
  kind: "say_reminder" | "plan_reminder" | "settle_prompt" | "listen_prompt";
  journal_entry_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const NOTIFICATION_COLUMNS = "id, kind, journal_entry_id, title, body, read_at, created_at";
export const NOTIFICATION_PAGE_SIZE = 50;

export interface NotificationInbox {
  notifications: AppNotification[];
  unreadCount: number;
}

export async function listNotifications(
  userId: string,
  limit = NOTIFICATION_PAGE_SIZE,
): Promise<NotificationInbox> {
  const supabase = createAdminClient();
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);
  if (list.error) throw new Error(`讀取通知失敗：${list.error.message}`);
  if (unread.error) throw new Error(`讀取未讀數失敗：${unread.error.message}`);
  return {
    notifications: (list.data ?? []) as AppNotification[],
    unreadCount: unread.count ?? 0,
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(`讀取未讀數失敗：${error.message}`);
  return count ?? 0;
}

const INBOX_SELECT =
  "id, kind, title, body, read_at, created_at, journal_entries(id, experienced_at, venue, status, work_title_fallback, works(kind, title, podcast_show, episode_number, poster_url))";

/**
 * notifications.url 是 migration 041（Spotify 收聽提醒）才有的欄：功能開關開了才讀，
 * 041 還沒套、開關關著時收件匣照舊不壞。
 */
function inboxSelect(): string {
  return spotifyListenEnabled() ? `url, ${INBOX_SELECT}` : INBOX_SELECT;
}

/** 收件匣頁：通知 + 連到的紀錄與作品（給 lib/notifications/inbox 組檢視） */
export async function listInboxRows(userId: string, limit = NOTIFICATION_PAGE_SIZE): Promise<InboxRow[]> {
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select(inboxSelect())
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`讀取收件匣失敗：${error.message}`);
  return (data ?? []) as unknown as InboxRow[];
}

/** ids 為 null 代表全部標已讀；回傳實際標記的數量 */
export async function markNotificationsRead(
  userId: string,
  ids: readonly string[] | null,
): Promise<number> {
  const supabase = createAdminClient();
  const base = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  const query = ids ? base.in("id", [...ids]) : base;
  const { data, error } = await query.select("id");
  if (error) throw new Error(`標記已讀失敗：${error.message}`);
  return (data ?? []).length;
}

/** 同 endpoint 重複訂閱時更新 keys（瀏覽器重新訂閱會換金鑰） */
export async function savePushSubscription(
  userId: string,
  input: PushSubscriptionInput,
): Promise<void> {
  const supabase = createAdminClient();
  // 同一裝置換人登入：endpoint 相同 → 改歸新登入者（瀏覽器只會有一個訂閱）
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      keys: input.keys,
      user_agent: input.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`儲存推播訂閱失敗：${error.message}`);
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
  if (error) throw new Error(`刪除推播訂閱失敗：${error.message}`);
}
