/**
 * 依筆名畫印章並自動帶上作者換過的印文（server component）。
 * 同一個請求裡的 PenSeal 併成一次查詢；client component 裡仍用 <Seal glyph={…} />，由 server 端把字傳進去。
 */

import { cache } from "react";
import { createGlyphBatcher } from "@/lib/seal/glyph-batch";
import { loadSealGlyphsByPenNames } from "@/lib/seal/glyph-repository";
import { Seal } from "./seal";

const requestBatcher = cache(() => createGlyphBatcher(loadSealGlyphsByPenNames));

/** 給 client component 用：server 端先取好字再傳下去 */
export function loadGlyphForPenName(penName: string): Promise<string | null> {
  return requestBatcher().load(penName);
}

export async function PenSeal(props: Omit<React.ComponentProps<typeof Seal>, "glyph">) {
  const glyph = await loadGlyphForPenName(props.penName);
  return <Seal {...props} glyph={glyph} />;
}
