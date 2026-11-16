/** TMDB 詳情（append_to_response=credits,recommendations,similar）→ 推薦要用的欄位（純函式，壞資料一律略過） */

import { TOP_CAST } from "./constants";
import type { Genre, Person, ScreenKind, TmdbInfo } from "./types";

type Raw = Record<string, unknown>;

function rows(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((row): row is Raw => typeof row === "object" && row !== null) : [];
}

function named(row: Raw): { id: number; name: string } | null {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  return typeof row.id === "number" && name ? { id: row.id, name } : null;
}

function people(list: Raw[]): Person[] {
  return list.map(named).filter((person): person is Person => person !== null);
}

function ids(block: unknown): number[] {
  const results = rows((block as Raw | null)?.results);
  return results.flatMap((row) => (typeof row.id === "number" ? [row.id] : []));
}

export function parseTmdbInfo(kind: ScreenKind, raw: Raw): TmdbInfo {
  const credits = (raw.credits ?? {}) as Raw;
  const genres = rows(raw.genres).map(named).filter((genre): genre is Genre => genre !== null);
  const directors =
    kind === "movie" ? people(rows(credits.crew).filter((member) => member.job === "Director")) : people(rows(raw.created_by));
  return {
    genres,
    directors,
    cast: people(rows(credits.cast)).slice(0, TOP_CAST),
    recommendations: ids(raw.recommendations),
    similar: ids(raw.similar),
  };
}
