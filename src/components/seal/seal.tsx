/**
 * 筆名印章（取代頭像）。純 SVG＋明體印文，server／client 都能用。
 * 24＝行內署名、40＝列表與同場、64＝專欄作者頁。深色（ink-950）區塊不放印章。
 */

import { sealOf, type SealSize } from "@/lib/seal/seal";

interface SealProps {
  penName: string;
  size?: SealSize;
  /** 作者在設定換的印文（限筆名中的字） */
  glyph?: string | null;
  /** 旁邊已有筆名時維持預設（裝飾、讀螢幕略過）；單獨出現時給名稱 */
  label?: string;
  className?: string;
}

export function Seal({ penName, size = 40, glyph, label, className = "" }: SealProps) {
  const seal = sealOf(penName, size, glyph);
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <span
      {...a11y}
      data-seal-shape={seal.shape}
      className={`relative inline-block flex-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} className="absolute inset-0 block text-ink-900">
        <path d={seal.path} fill={seal.filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={seal.strokeWidth} />
      </svg>
      {seal.quad ? (
        // 讀序右上→右下→左上→左下＝一、二、一、二：上列兩格是字一、下列兩格是字二；左上與右下反白
        <span className="absolute inset-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-[2px] font-serif-tc font-bold leading-none">
          {[seal.quad[0], seal.quad[0], seal.quad[1], seal.quad[1]].map((char, index) => {
            const inverted = index === 0 || index === 3;
            return (
              <span
                key={index}
                className={`flex items-center justify-center ${inverted ? "bg-ink-900 text-paper" : "text-ink-900"}`}
                style={{ fontSize: seal.quadPx }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center font-serif-tc font-bold leading-none ${
            seal.filled ? "text-paper" : "text-ink-900"
          }`}
          style={{ fontSize: seal.glyphPx }}
        >
          {seal.glyph}
        </span>
      )}
    </span>
  );
}
