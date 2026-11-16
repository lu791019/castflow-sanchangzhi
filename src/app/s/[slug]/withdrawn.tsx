import Link from "next/link";
import { formatIssueNo } from "@/lib/works/format";

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/**
 * 分享頁 404・已收回（設計稿 P2）：陌生人點到失效連結。不怪連結、不怪讀者，導回目錄並邀請說一段。
 * issueNo：文章還在但設成私人時，劃掉原本的期號；完全找不到時不顯示期號。
 */
export function Withdrawn({ issueNo }: { issueNo: string | null }) {
  return (
    <div className="min-h-dvh bg-paper font-sans-tc text-ink-900">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
        <header className="mx-4 flex h-12 flex-none items-center justify-between border-b border-ink-950">
          <Link href="/" className="font-serif-tc text-prose font-bold tracking-[0.12em] text-ink-950 no-underline">
            散場之後
          </Link>
          <span className="text-eyebrow tracking-[0.14em] text-ink-600">散場誌</span>
        </header>

        <main className="px-4 pt-[22px]">
          <div className="flex items-center gap-2.5 text-caption tracking-[0.2em]">
            {issueNo ? (
              <>
                <span className="text-ink-600 line-through decoration-ink-400">{formatIssueNo(issueNo)}</span>
                <span aria-hidden="true" className="block h-px w-5 bg-ink-400" />
              </>
            ) : null}
            <span className="text-ink-600">這一頁暫時空著</span>
          </div>
          <div aria-hidden="true" className="p2-manuscript relative mt-3.5 h-[151px] w-full max-w-[331px]">
            <div className="absolute top-[34px] right-[22px] w-[150px] -rotate-[7deg] rounded-[4px] border-2 border-ember-dark bg-paper p-[3px]">
              <div className="flex flex-col items-center gap-0.5 rounded-[2px] border border-ember-dark pt-2 pb-[7px]">
                <span className="pl-[0.3em] text-eyebrow tracking-[0.3em] text-ember-dark">散場之後</span>
                <span className="pl-[0.16em] font-serif-tc text-quote font-bold tracking-[0.16em] text-ember-dark">已收回</span>
              </div>
            </div>
          </div>
          <h1 className="mt-[22px] mb-0 font-serif-tc text-headline leading-[1.38] font-bold text-ink-950">這一篇已經收回了。</h1>
          <p className="mt-2.5 mb-0 text-lede leading-[1.8] text-ink-800">
            作者把它收進抽屜，或設成了私人。不是連結壞了，也不是你的問題。
          </p>
          <Link href="/" className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-lede font-bold text-ember-dark no-underline">
            翻翻今晚的目錄 →
          </Link>
        </main>

        <section className="p4-inverse p4-band mt-auto flex flex-col bg-ink-950 px-4 pt-[26px] pb-7 text-paper">
          <span className="text-caption tracking-[0.2em] text-ember-soft">換你說</span>
          <h2 className="mt-2.5 mb-0 font-serif-tc text-section leading-[1.45] font-bold">你也看過？說一段。</h2>
          <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-300">
            說的或打的都行，一分鐘就好。我們幫你整理成一篇，署上你的名字。
          </p>
          <Link
            href="/say"
            className="mt-5 flex h-[52px] items-center justify-center gap-2 rounded-[4px] bg-paper text-lede font-bold tracking-[0.1em] text-ink-950 no-underline"
          >
            <MicIcon />
            說一段
          </Link>
          <p className="mt-2.5 mb-0 text-center text-eyebrow text-ink-300">不用先註冊</p>
        </section>
      </div>
    </div>
  );
}
