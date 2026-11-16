import Link from "next/link";
import { wavePath } from "@/lib/share/wave";

interface WorkCtaProps {
  slug: string;
  feelingCount: number;
  /** 標題第二行：《海街日記》？ / 這一集？ */
  headlineTarget: string;
  /** 按鈕副標「已帶入…」用的作品稱呼 */
  prefillName: string;
  verb: "看" | "聽";
}

function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-paper"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/** 深色 CTA：「你也看過/聽過？說一段」→ /say?work=<slug>（cta.prefill） */
export function WorkCta({ slug, feelingCount, headlineTarget, prefillName, verb }: WorkCtaProps) {
  const isFirst = feelingCount === 0;
  return (
    <section className="p4-inverse p4-band mt-12 flex flex-col bg-ink-950 px-4 pb-10 text-paper">
      <div className="-mx-4 h-14 overflow-hidden" aria-hidden="true">
        <svg width="420" height="56" viewBox="0 0 420 56" fill="none" className="block">
          {isFirst ? null : (
            <path
              className="work-w2 stroke-ink-700"
              strokeWidth="1"
              d={wavePath({ y: 22, amplitude: 8, halfPeriod: 40, width: 520 })}
            />
          )}
          <path
            className="work-w1 stroke-ember-soft"
            strokeWidth="1.4"
            d={wavePath({ y: 34, amplitude: 10, halfPeriod: 30, width: 480 })}
          />
        </svg>
      </div>
      <span className="mt-3 text-caption tracking-[0.2em] text-ember-soft">
        第 {feelingCount + 1} 段，可以是你的
      </span>
      <h2 className="mt-3 mb-0 font-serif-tc text-headline leading-[1.4] font-bold">
        你也{verb}過
        <br />
        {headlineTarget}？
      </h2>
      {isFirst ? null : (
        <p className="mt-3 mb-0 text-note leading-[1.85] text-ink-300">
          對著手機說一分鐘。你的聲音會被收進這一頁，和其他 {feelingCount} 段放在一起。
        </p>
      )}
      <Link
        href={`/say?work=${encodeURIComponent(slug)}`}
        className="mt-[26px] flex h-[60px] items-center gap-3.5 self-stretch rounded-[30px] bg-paper pr-5 pl-2 text-ink-950 no-underline"
      >
        <span className="relative block size-11 flex-none">
          <span className="work-ring absolute inset-0 block rounded-full border-[1.5px] border-ember" />
          <span className="work-ring-delay absolute inset-0 block rounded-full border-[1.5px] border-ember" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ember-dark">
            <MicIcon />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[16px] font-bold">{isFirst ? "說第一段" : "說一段"}</span>
          <span className="truncate text-eyebrow text-ink-700">已帶入{prefillName}</span>
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  );
}
