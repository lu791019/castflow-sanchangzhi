/**
 * 分享卡（OG）的印章資料：形狀與印文一律走全站同一套規則（src/lib/seal/seal.ts 的 sealShape／sealGlyph，UX-13），
 * 這裡只換成 Satori 好畫的「形狀編號＋字」。四分格刻前兩字，讀序同 <Seal>：上列字一、下列字二。
 */

import { SEAL_SHAPE_NAMES, sealGlyph, sealShape } from "@/lib/seal/seal";

export const SEAL_SHAPE_COUNT = SEAL_SHAPE_NAMES.length;
const QUAD_SHAPE = 7;

export interface Seal {
  shape: number;
  chars: string[];
}

export function sealFor(rawName: string): Seal | null {
  const name = rawName.trim();
  if (!name) return null;
  const shape = sealShape(name);
  if (shape !== QUAD_SHAPE) return { shape, chars: [sealGlyph(name)] };
  const [first, second = first] = Array.from(name);
  return { shape, chars: [first, first, second, second] };
}
