import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth/page";
import { loadBeforeView } from "@/lib/before/load";
import { formatMastheadDate } from "@/lib/feed/entries";
import { loadTasteMatches } from "@/lib/match/load";
import { TasteMatches } from "@/components/match/taste-matches";
import { AllEmptyGuide, SomeoneSaid, ThisWeek, YourPlans } from "@/components/before/before-sections";
import { YouMightLike } from "@/components/recommend/you-might-like";
import { TourInfoButton } from "@/components/tour/tour-info-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "散場之前｜散場誌",
  description: "這週上映、開演、開展，排進行程",
};

/** 散場之前：登入者首屏（雛型版本二：這週上映・開演・開展 → 你排好的 → 有人說了） */
export default async function BeforePage() {
  const userId = await requirePageUserId("/before");
  const now = new Date();
  const [view, matches] = await Promise.all([loadBeforeView(userId, now), loadTasteMatches(userId)]);
  const allEmpty = view.cards.length === 0 && view.upcoming.length === 0 && view.said.length === 0;

  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
        <span className="flex items-center gap-1 text-eyebrow tracking-[0.14em] text-ink-600 tabular-nums">
          {formatMastheadDate(now)}
          <TourInfoButton tour="before-tour-info" />
        </span>
      </header>

      {/* 寬螢幕（≥1024，Q-60）：容器 1360、大標＋雙線、主欄卡片隨寬度增欄、邊欄 340–400 */}
      <div className="px-4 pb-[120px] lg:mx-auto lg:max-w-[1440px] lg:px-10 lg:pb-16">
        <section className="pt-[22px] lg:border-b-[3px] lg:border-double lg:border-ink-950 lg:pt-12 lg:pb-5">
          <span className="flex items-center justify-between">
            <span className="text-caption font-bold tracking-[0.2em] text-ember-dark lg:text-note lg:tracking-[0.3em]">這週上映・開演・開展</span>
            {/* 寬螢幕沒有上面的窄版頁首：重看導覽 ⓘ 放這裡（10/16 Dex：舊帳號要找得到導覽按鈕） */}
            <span className="hidden lg:inline-flex">
              <TourInfoButton tour="before-tour-info" />
            </span>
          </span>
          <h1 className="mt-2.5 mb-0 font-serif-tc text-headline leading-[1.38] font-bold text-ink-950 lg:mt-3 lg:max-w-[6.5em] lg:text-[clamp(48px,6vw,88px)] lg:leading-[1.1] lg:font-black">
            這週，
            <br className="md:hidden" />
            有什麼值得出門？
          </h1>
        </section>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-x-12 min-[90rem]:grid-cols-[minmax(0,1fr)_400px]">
          <ThisWeek cards={view.cards} hasLive={view.hasLive} hasCulture={view.hasCulture} eventSources={view.eventSources} liveSub={view.liveSub} cityFilter={view.cityFilter} />
          <div className="lg:pt-8">
            <YourPlans entries={view.upcoming} />
            <YouMightLike userId={userId} />
            <TasteMatches matches={matches} />
            <SomeoneSaid entries={view.said} />
          </div>
        </div>

        {allEmpty ? <AllEmptyGuide /> : null}
      </div>
    </>
  );
}
