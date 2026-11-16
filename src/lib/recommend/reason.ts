/** 推薦理由文案（純函式）：一句話，盡量引用使用者自己的作品——只給本人看 */

import type { MediaKey } from "@/lib/taste/types";
import type { Reason, SeedSource } from "./types";

const SEED_VERBS: Record<SeedSource, string> = { wrote: "寫過", logged: "記過", planned: "排了" };
/** 當形容詞用：「你寫過的〈人聲〉」「你排進行程的〈X〉」 */
const SEED_ATTRIBUTES: Record<SeedSource, string> = { wrote: "寫過的", logged: "記過的", planned: "排進行程的" };

/** 媒介偏好與「出門」吻合時的說法（電影、演出、展覽要出門；影集多半在家） */
const OUT_PHRASES: Partial<Record<MediaKey, string>> = {
  movie: "你喜歡進戲院看電影",
  live: "你喜歡出門看演出",
  exhibition: "你喜歡出門看展覽",
};

const HOME_PHRASES: Partial<Record<MediaKey, string>> = {
  series: "你常在家追劇",
  podcast: "你常聽 Podcast",
};

const MEDIA_PHRASES: Record<MediaKey, string> = {
  movie: "你常看電影",
  series: "你常追劇",
  podcast: "你常聽 Podcast",
  music: "你常聽音樂",
  live: "你喜歡看演出",
  exhibition: "你喜歡看展覽",
};

function tastePhrase(media: MediaKey, side: "home" | "out" | null): string {
  const bySide = side === "out" ? OUT_PHRASES[media] : side === "home" ? HOME_PHRASES[media] : undefined;
  return bySide ?? MEDIA_PHRASES[media];
}

export function formatReason(reason: Reason): string {
  if (reason.type === "taste") return tastePhrase(reason.media, reason.side);
  const work = `〈${reason.seed.title}〉`;
  const yours = `你${SEED_ATTRIBUTES[reason.seed.source]}${work}`;
  switch (reason.type) {
    case "hit":
      return `因為你${SEED_VERBS[reason.seed.source]}${work}`;
    case "director":
      return `跟${yours}同一位導演・${reason.name}`;
    case "cast":
      return `有${yours}裡的${reason.name}`;
    case "genre":
      return `跟${yours}一樣是「${reason.name}」`;
  }
}
