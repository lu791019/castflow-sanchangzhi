/** 散場之前「在哪個縣市」的存取（server only，service role；key 帶 userId，只讀寫本人那一列） */

import { createAdminClient } from "@/lib/supabase/admin";
import { beforeCityKey, parseStoredCity } from "./city-setting";

export async function loadBeforeCity(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("settings").select("value").eq("key", beforeCityKey(userId)).maybeSingle();
  if (error) throw new Error(`讀取縣市篩選失敗：${error.message}`);
  return parseStoredCity(data?.value);
}

/** city null＝全部縣市（照樣存一列，之後改回來也是同一列） */
export async function saveBeforeCity(userId: string, city: string | null, now: Date): Promise<void> {
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: beforeCityKey(userId), value: { city }, updated_at: now.toISOString() });
  if (error) throw new Error(`儲存縣市篩選失敗：${error.message}`);
}
