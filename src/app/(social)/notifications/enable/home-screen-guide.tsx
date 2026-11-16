"use client";

/** iPhone 加入主畫面引導（設計稿原文）：iPhone 的網頁推播只在主畫面模式可用 */

import { CloseIcon } from "@/components/journal/icons";

function Step({ index, children, last = false }: { index: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li
      className={`grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 py-3.5 ${index === "一" ? "border-t border-ink-950" : "border-t border-ink-200"} ${last ? "border-b border-b-ink-200" : ""}`}
    >
      <span className="font-serif-tc text-prose font-bold text-ember-dark">{index}</span>
      <div className="flex flex-col gap-2">{children}</div>
    </li>
  );
}

function Glyph({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function HomeScreenGuide({ onDone, onLater }: { onDone: () => void; onLater: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950">
        <span className="text-caption font-bold tracking-[0.3em] text-ember-dark">在 iPhone 上收到提醒</span>
        <button type="button" onClick={onLater} aria-label="關閉" className="-mr-3 flex size-11 items-center justify-center text-ink-700">
          <CloseIcon />
        </button>
      </header>
      <div className="px-4 pt-5">
        <h1 className="m-0 font-serif-tc text-section leading-[1.55] font-bold text-ink-950">
          先把散場誌放到主畫面，
          <br />
          iPhone 才能幫你轉達提醒。
        </h1>
        <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">這是 iPhone 對網頁通知的規定。只要做一次，大約十秒。</p>
      </div>
      <ol className="mx-4 mt-4 flex list-none flex-col p-0">
        <Step index="一">
          <span className="text-lede text-ink-950">
            點 Safari 下方的<b>「分享」</b>
          </span>
          <div aria-hidden="true" className="flex h-12 items-center justify-around rounded-control border border-ink-200 bg-paper-2 text-ink-400">
            <Glyph d="M15 6l-6 6 6 6" />
            <Glyph d="M9 6l6 6-6 6" />
            <span className="flex size-9 items-center justify-center rounded-full bg-ember-tint text-ember-deep shadow-[0_0_0_1.5px_var(--color-ember-dark)]">
              <Glyph d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
            </span>
            <Glyph d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
            <Glyph d="M4 4h12v12H4zM8 8h12v12H8z" />
          </div>
        </Step>
        <Step index="二">
          <span className="text-lede text-ink-950">
            往下找到<b>「加入主畫面」</b>
          </span>
          <div aria-hidden="true" className="flex flex-col rounded-control border border-ink-200 text-note">
            <span className="flex h-[34px] items-center justify-between border-b border-ink-50 px-3 text-ink-400">
              加入書籤
              <Glyph d="M6 4h12v16l-6-4-6 4z" size={15} />
            </span>
            <span className="flex h-[38px] items-center justify-between bg-ember-tint px-3 font-bold text-ember-deep shadow-[inset_2px_0_0_var(--color-ember)]">
              加入主畫面
              <Glyph d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM12 8v8M8 12h8" size={16} />
            </span>
          </div>
        </Step>
        <Step index="三" last>
          <span className="text-lede leading-[1.6] text-ink-950">
            從主畫面打開散場誌，
            <br />
            再按一次<b>「好，提醒我」</b>
          </span>
          <div aria-hidden="true" className="flex h-[60px] items-center justify-center gap-3.5 rounded-control border border-ink-200 bg-paper-2">
            <span className="block size-[34px] rounded-[8px] bg-ink-50" />
            <span className="block size-[34px] rounded-[8px] bg-ink-50" />
            <span className="flex size-[34px] items-center justify-center rounded-[8px] bg-ink-950 font-serif-tc text-lede font-bold text-paper shadow-[0_0_0_2px_var(--color-paper-2),0_0_0_3.5px_var(--color-ember-dark)]">
              C
            </span>
            <span className="block size-[34px] rounded-[8px] bg-ink-50" />
          </div>
        </Step>
      </ol>
      <div className="mt-auto flex flex-col px-4 pt-6 pb-5">
        <p className="mt-0 mb-3 text-eyebrow leading-[1.7] text-ink-600">
          Android 手機和電腦不需要這一步。不加也沒關係，提醒會留在 App 的收件匣裡。
        </p>
        <button type="button" onClick={onDone} className="h-[52px] rounded-control bg-action-primary text-lede font-bold tracking-[0.1em] text-paper">
          我知道了
        </button>
        <button type="button" onClick={onLater} className="mt-1 min-h-11 text-note text-ink-700">
          以後再說
        </button>
      </div>
    </div>
  );
}
