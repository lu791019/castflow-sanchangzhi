"use client";

/** 0.5～5 星（Q-72）：點第 n 顆＝n 顆；再點同一顆＝n−0.5（半顆）；再點回 n。可清除。 */

import { formatStars, nextRating } from "@/lib/watched/post";

function StarGlyph({ fill }: { fill: "full" | "half" | "none" }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="star-half">
          <stop offset="50%" stopColor="var(--color-ember)" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"
        fill={fill === "full" ? "var(--color-ember)" : fill === "half" ? "url(#star-half)" : "none"}
        stroke={fill === "none" ? "var(--color-ink-400)" : "var(--color-ember)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="幾顆星">
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value === null ? "none" : value >= n ? "full" : value >= n - 0.5 ? "half" : "none";
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} 顆星`}
            aria-pressed={value !== null && value >= n - 0.5}
            onClick={() => onChange(nextRating(value, n))}
            className="flex size-11 flex-none items-center justify-center"
          >
            <StarGlyph fill={fill} />
          </button>
        );
      })}
      <span className="ml-1 flex-none text-note font-medium whitespace-nowrap text-ink-700" aria-live="polite">
        {value === null ? "未評" : `${value} 顆`}
      </span>
      {value !== null ? (
        <button type="button" onClick={() => onChange(null)} className="ml-auto min-h-11 flex-none px-2 text-caption whitespace-nowrap text-ink-600 underline">
          清除
        </button>
      ) : null}
      <span className="sr-only">{value === null ? "" : formatStars(value)}</span>
    </div>
  );
}
