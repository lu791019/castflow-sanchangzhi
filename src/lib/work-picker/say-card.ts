/** 說一段頁：選擇器選定的 work → 作品卡（RecentWork）；動詞與類型標籤沿用 works/format */

import type { RecentWork } from "@/app/(social)/say/say-stage";
import { isPodcast, KIND_LABELS, workVerb, type Work } from "@/lib/works/format";

export function toSayWork(work: Work, now: Date): RecentWork {
  const podcast = isPodcast(work);
  return {
    id: work.id,
    workId: work.id,
    title: work.title,
    workTitle: podcast && work.podcast_show ? work.podcast_show : work.title,
    categoryLabel: KIND_LABELS[work.kind],
    createdAt: now.toISOString(),
    verb: workVerb(work),
    note: podcast ? work.title : "剛選的作品",
    posterUrl: work.poster_url,
  };
}
