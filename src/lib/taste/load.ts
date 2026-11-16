/** 品味資料（server only）：讀行為足跡＋問卷 → buildTasteProfile */

import { buildTasteProfile } from "./profile";
import { loadTasteInputs } from "./repository";
import type { TasteProfile } from "./types";

export async function loadTasteProfile(userId: string): Promise<TasteProfile> {
  return buildTasteProfile(await loadTasteInputs(userId));
}
