/** 索引共用小元件：命中字底色、右箭頭（作品封面改用 components/covers/work-cover） */

import type { HighlightPart } from "@/lib/catalog/search";

/** search.match：命中字 ember-100 底色，像用鉛筆畫過 */
export function Highlighted({ parts }: { parts: HighlightPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className="bg-ember-tint-2 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function ChevronRight() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-ink-600">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
