/** 記一筆作品列的補充說明（純函式）：Podcast 卡片上只寫節目名，選了哪一集寫在作品列下方（UX-27） */

import type { RecentLogWork } from "./recent-works";

export function episodeCaption(work: RecentLogWork): string | null {
  if (work.kind !== "podcast_episode") return null;
  const title = work.title.trim();
  if (!title || title === work.podcast_show?.trim()) return null;
  return work.episode_number ? `第 ${work.episode_number} 集・${title}` : title;
}
