"use client";

/** 桌機「用打的」右側起頭提示（P4 桌機 說一段 B）：點一下，問題放進左邊當開頭 */

const PROMPTS = ["哪一幕讓你停住了？", "它讓你想起了誰？", "散場後，你第一件想做的事？"];

export function TextPrompts({ onPick, className }: { onPick: (prompt: string) => void; className?: string }) {
  return (
    <aside aria-label="起頭提示" className={className}>
      <span className="border-b border-ink-800 pb-3 text-eyebrow font-bold tracking-[0.2em] text-ember-soft">卡住的話，從這裡起頭</span>
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onPick(prompt)}
          className="min-h-[52px] border-b border-ink-800 bg-transparent text-left font-serif-tc text-lede text-ink-300"
        >
          {prompt}
        </button>
      ))}
      <span className="pt-3 text-caption text-ink-400">點一下，問題會放進左邊當開頭。</span>
    </aside>
  );
}
