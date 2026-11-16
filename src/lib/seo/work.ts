/** 作品頁 JSON-LD：作品型別＋（≥3 人評過才有）AggregateRating（Q-83、Q-85） */

import type { RatingSummary } from "@/lib/watched/rating-summary";
import type { WorkKind } from "@/lib/works/format";

const SCHEMA_TYPES: Record<WorkKind, string> = {
  movie: "Movie",
  series: "TVSeries",
  podcast_episode: "PodcastEpisode",
  music: "MusicAlbum",
  live: "Event",
  exhibition: "ExhibitionEvent",
};

export interface WorkJsonLdInput {
  kind: WorkKind;
  title: string;
  url: string;
  image: string | null;
  year: number | null;
  rating: RatingSummary;
}

export function workJsonLd({ kind, title, url, image, year, rating }: WorkJsonLdInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPES[kind],
    name: title,
    url,
    ...(image ? { image } : {}),
    ...(year && (kind === "movie" || kind === "series") ? { dateCreated: String(year) } : {}),
    ...(rating.average !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average,
            ratingCount: rating.count,
            bestRating: 5,
            worstRating: 0.5,
          },
        }
      : {}),
  };
}
