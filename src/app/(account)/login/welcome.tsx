import Link from "next/link";
import { VerticalDigits } from "@/components/ui/vertical-digits";
import { formatMastheadDate } from "@/lib/feed/entries";
import { LOGIN_START_STEP } from "./login-mode";

const MASTHEAD = ["散", "場", "之", "後"];
/** 序號用阿拉伯數字（Q-58／UX-23，同刊頭日期的 tabular-nums） */
const STEPS = [
  { no: "1", text: "看完、聽完，按住中間的圓鈕說一段" },
  { no: "2", text: "整理成一篇專欄，你來校樣" },
  { no: "3", text: "想發佈的時候，再署上你的筆名" },
];

/** 第一次打開 A・歡迎：刊名直排一字一格（display.cover 56）＋三步＋「開始」直接去說一段；下方另有 email 開始／找回兩個入口 */
export function Welcome() {
  const now = new Date();
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-4 flex h-[52px] flex-none items-center justify-between border-b border-ink-950">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600 tabular-nums">
          {now.getFullYear()}.{formatMastheadDate(now).replace(" ", "　")}
        </span>
      </header>

      <section aria-label="封面" className="relative mx-4 mt-8 h-[289px] flex-none">
        <div className="absolute top-0 left-0 flex flex-col gap-2">
          <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">創刊號</span>
          <span className="text-caption tracking-[0.14em] text-ink-600">一本由你說出來的刊物</span>
        </div>
        <p className="absolute bottom-0 left-0 m-0 font-serif-tc text-section leading-[1.75] font-bold tracking-[0.04em] text-ink-950">
          看完、聽完、
          <br />
          散場之後，
          <br />
          說一段。
        </p>
        <span aria-hidden="true" className="absolute top-0.5 right-[84px] text-eyebrow tracking-[0.3em] text-ink-600 [writing-mode:vertical-rl]">
          <VerticalDigits text="散場誌・第 0001 號" />
        </span>
        <h1 aria-label="散場之後" className="absolute top-0 right-0 m-0 flex w-[72px] flex-col">
          {MASTHEAD.map((char, index) => (
            <span
              key={char}
              aria-hidden="true"
              className={`flex h-[73px] items-center justify-center border border-ink-200 font-serif-tc text-[56px] leading-none font-bold text-ink-950 ${
                index > 0 ? "-mt-px" : ""
              }`}
            >
              {char}
            </span>
          ))}
        </h1>
      </section>

      <div aria-hidden="true" className="mx-4 mt-[26px] flex h-7 flex-none items-center gap-2.5">
        <svg width="290" height="28" viewBox="0 0 290 28" fill="none" className="block max-w-full flex-none">
          <path d="M0 14 H40 M128 14 H290" stroke="var(--color-ink-300)" strokeWidth="1" />
          <path
            d="M40 14 Q44 9 48 14 Q52 3 56 14 Q60 24 64 14 Q68 6 72 14 Q76 20 80 14 Q84 9 88 14 Q92 2 96 14 Q100 26 104 14 Q108 8 112 14 Q116 18 120 14 Q124 12 128 14"
            stroke="var(--color-ember)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <ol aria-label="怎麼用" className="mx-4 mt-[22px] list-none border-t border-ink-950 p-0">
        {STEPS.map((step) => (
          <li key={step.no} className="grid min-h-[42px] grid-cols-[26px_minmax(0,1fr)] items-center border-b border-ink-200">
            <span className="text-lede font-bold text-ember-dark tabular-nums">{step.no}</span>
            <span className="text-note text-ink-800">{step.text}</span>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-col px-4 pt-8 pb-3.5">
        <Link
          href="/say"
          className="flex h-[52px] items-center justify-center rounded-[4px] bg-ember-dark pl-[0.2em] text-lede font-bold tracking-[0.2em] text-paper no-underline"
        >
          開始
        </Link>
        <p className="mt-2.5 mb-0 text-center text-caption text-ink-600">不用先註冊，先說一段再說</p>
        {/* 想先用 email 開專欄的新人入口（UX-12）；有專欄的人走「找回來」 */}
        <Link href={`/login?step=${LOGIN_START_STEP}`} className="mt-1 flex min-h-11 items-center justify-center text-note text-ink-700 no-underline">
          想先開好專欄？<span className="text-ink-950 shadow-[inset_0_-1px_0_var(--color-ink-400)]">用 email 開始</span>
        </Link>
        <Link href="/login?step=mail" className="flex min-h-11 items-center justify-center text-note text-ink-700 no-underline">
          已經有專欄了？<span className="text-ink-950 shadow-[inset_0_-1px_0_var(--color-ink-400)]">用 email 找回來</span>
        </Link>
      </div>
    </main>
  );
}
