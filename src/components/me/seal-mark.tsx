import { Seal } from "@/components/seal/seal";

/**
 * 取筆名的印章預覽：跟全站同一套規則（sealOf／sealGlyph，UX-13），輸入時即時換印。
 * 還沒寫筆名時是虛線空位。
 */
export function SealMark({ name, size, glyph = null }: { name: string; size: 24 | 40; glyph?: string | null }) {
  if (!name.trim()) {
    const box = size === 40 ? "size-10" : "size-6";
    return <span aria-hidden="true" className={`block flex-none rounded-[2px] border border-dashed border-ink-300 ${box}`} />;
  }
  return size === 40 ? (
    <Seal penName={name.trim()} size={40} glyph={glyph} label="由筆名生成的印章" />
  ) : (
    <Seal penName={name.trim()} size={24} glyph={glyph} />
  );
}
