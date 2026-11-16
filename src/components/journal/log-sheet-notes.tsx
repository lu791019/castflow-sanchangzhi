"use client";

/** 記一筆 sheet 主鈕上方的一行：錯誤／同作品再記確認（UX-26）／登入回來還原提示 */

export interface RepeatAsk {
  prompt: string;
  /** 確認後要接著做的：記下（蓋章）或帶去說一段 */
  then: "submit" | "say";
}

interface RepeatConfirmProps {
  prompt: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 不用 browser confirm：在主鈕的位置問一句，兩顆鈕 */
export function RepeatConfirm({ prompt, onConfirm, onCancel }: RepeatConfirmProps) {
  return (
    <div role="alertdialog" aria-label="再記一筆確認" aria-describedby="log-repeat-prompt" className="flex flex-col">
      <p id="log-repeat-prompt" className="mt-0 mb-2.5 font-serif-tc text-lede leading-[1.7] font-bold text-ink-950">
        {prompt}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onCancel} className="h-[52px] rounded-control border border-ink-950 text-lede font-bold tracking-[0.12em] text-ink-950">
          不用了
        </button>
        <button type="button" onClick={onConfirm} autoFocus className="h-[52px] rounded-control bg-action-primary text-lede font-bold tracking-[0.12em] text-paper">
          再記一筆
        </button>
      </div>
    </div>
  );
}

export function SheetNote({ error, restored }: { error: string | null; restored: boolean }) {
  if (error) {
    return (
      <p role="alert" className="mb-2 text-caption text-destructive">
        {error}
      </p>
    );
  }
  if (!restored) return null;
  return (
    <p role="status" className="mb-2 text-caption text-ink-700">
      剛剛填的還在，確認後按下去就記好了。
    </p>
  );
}

/** Podcast 選了某一集：作品列下方寫哪一集（UX-27），排版同「在哪看」那一行 */
export function EpisodeLine({ caption }: { caption: string }) {
  return (
    <p className="mx-4 mt-2 mb-0 flex min-h-9 min-w-0 items-center gap-x-4">
      <span className="flex-none text-eyebrow font-bold tracking-[0.16em] text-ink-600">這一集</span>
      <span className="min-w-0 truncate text-note text-ink-800">{caption}</span>
    </p>
  );
}

