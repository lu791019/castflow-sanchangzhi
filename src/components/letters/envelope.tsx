/** 信封（P3 Token envelope：112×70，封口 V 線交於 (56,40)）；寄件人印章 24 壓在封口。空信箱用淡線、無印章 */

import { Seal } from "@/components/seal/seal";

export function Envelope({ senderName, senderGlyph, empty = false }: { senderName?: string; senderGlyph?: string | null; empty?: boolean }) {
  const line = empty ? "border-ink-300" : "border-ink-900";
  const stroke = empty ? "var(--color-ink-300)" : "var(--color-ink-900)";
  return (
    <span aria-hidden="true" className={`relative block h-[70px] w-28 rounded-[2px] border ${line}`}>
      <svg width="112" height="70" viewBox="0 0 112 70" fill="none" className="absolute -top-px -left-px block">
        <path d="M1 1L56 40L111 1" stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      </svg>
      {empty ? (
        <span className="absolute top-2 right-2 block h-5 w-4 border border-dashed border-ink-300" />
      ) : senderName ? (
        <span className="absolute top-7 left-[43px] block size-6 bg-paper">
          <Seal penName={senderName} glyph={senderGlyph} size={24} />
        </span>
      ) : null}
    </span>
  );
}

/** 小信封圖示（20px，寄出後收成的一行、來信入口） */
export function EnvelopeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
