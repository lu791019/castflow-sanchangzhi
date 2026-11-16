/**
 * 散場之前「你可能會想看」（作品推薦 Q-40 C）：最多 6 張，每張一句理由引用自己寫過／記過的作品。
 * 理由會提到私人文章的作品名，所以只在本人的散場之前出現。
 * 包在 Suspense 裡串流：TMDB 慢不擋首屏；沒有訊號或上游失敗整區不顯示。
 */

import { Suspense } from "react";
import { loadRecommendations } from "@/lib/recommend/load";
import { RecommendCardView } from "./recommend-card";

export const RECOMMEND_TITLE = "你可能會想看";

async function RecommendBlock({ userId }: { userId: string }) {
  const items = await loadRecommendations(userId, new Date());
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="before-recommend" data-testid="recommend" className="mt-6 flex flex-col">
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-2">
        <h2 id="before-recommend" className="m-0 font-serif-tc text-section font-bold text-ink-950">
          {RECOMMEND_TITLE}
        </h2>
        <span className="text-eyebrow text-ink-600">只有你看得到</span>
      </div>
      <div className="p4-stagger grid grid-cols-2 gap-3 pt-3 md:grid-cols-3 lg:grid-cols-1 lg:gap-0 lg:pt-0">
        {items.map((item) => (
          <RecommendCardView key={item.candidate.card.key} item={item} />
        ))}
      </div>
    </section>
  );
}

export function YouMightLike({ userId }: { userId: string }) {
  return (
    <Suspense fallback={null}>
      <RecommendBlock userId={userId} />
    </Suspense>
  );
}
