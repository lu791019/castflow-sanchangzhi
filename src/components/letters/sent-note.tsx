/** 寄出後收成的一行（文章頁 E）：你在 10.10 寄了一封信給林小晴。 */

import { sentLine } from "@/lib/letters/format";
import { EnvelopeIcon } from "./envelope";

export function SentNote({ sentAt, authorName }: { sentAt: string; authorName: string }) {
  return (
    <div className="mt-3.5 grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-2.5 border-y border-ink-200 py-3.5">
      <EnvelopeIcon className="mt-0.5 text-ink-600" />
      <span className="text-note leading-[1.75] text-ink-700">
        {sentLine(sentAt, authorName)}
        <br />
        如果刊登了，會出現在上面的讀者來函。
      </span>
    </div>
  );
}
