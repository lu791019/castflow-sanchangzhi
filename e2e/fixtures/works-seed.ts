/**
 * 測試自己種的作品（slug e2e- 開頭，accounts.trackWork 登記、結束後清）。
 * 取代「從 DB 挑一部既有電影」：雲端有真作品，不能假設它存在，也不該把測試資料掛到真作品上。
 */

import { serviceRoleKey, supabaseUrl } from "./env";
import type { Accounts } from "./test";

export interface SeededWork {
  id: string;
  slug: string;
  title: string;
  runtime_minutes: number | null;
  podcast_show: string | null;
  episode_number: number | null;
}

export interface WorkSeed {
  kind?: "movie" | "podcast_episode";
  title?: string;
  posterUrl?: string | null;
  runtimeMinutes?: number | null;
  podcastShow?: string | null;
  episodeNumber?: number | null;
}

export async function seedTestWork(accounts: Accounts, tag: string, seed: WorkSeed = {}): Promise<SeededWork> {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const kind = seed.kind ?? "movie";
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/works?select=id,slug,title,runtime_minutes,podcast_show,episode_number`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      kind,
      title: seed.title ?? `${kind === "movie" ? "測試電影" : "測試單集"} ${tag} ${stamp}`,
      slug: `e2e-${tag}-${stamp}`,
      poster_url: seed.posterUrl ?? null,
      runtime_minutes: seed.runtimeMinutes ?? null,
      podcast_show: seed.podcastShow ?? null,
      episode_number: seed.episodeNumber ?? null,
    }),
  });
  if (!response.ok) throw new Error(`[works seed] insert works → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [work] = (await response.json()) as SeededWork[];
  accounts.trackWork(work.id);
  return work;
}
