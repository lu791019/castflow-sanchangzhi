/**
 * 瀏覽器端 Supabase client（anon key）。
 *
 * 目前沒有任何程式使用：登入走 server action（src/app/auth/actions.ts），
 * 所有資料讀寫一律走 server component / server action / API route（service role + 擁有者檢查）。
 * RLS（migration 015）是第二道防線，不是主要授權機制。
 *
 * 保留給未來只需要 anon 權限的瀏覽器功能（例如 Realtime 訂閱、auth 狀態監聽）。
 * 不要用它依 id 查詢或寫入使用者資料表——那會讓授權只剩 RLS 一層。
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
