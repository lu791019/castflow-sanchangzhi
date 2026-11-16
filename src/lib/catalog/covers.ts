/** 索引刊頭大標與欄目封面的小資料推導（純函式） */

import { CATALOG_COLUMNS, type ColumnKey } from "./columns";

const SHORT_LINE_MAX = 8;

export function columnCounts(columns: ReadonlyMap<string, ColumnKey>): Record<ColumnKey, number> {
  const counts = Object.fromEntries(CATALOG_COLUMNS.map((column) => [column.key, 0])) as Record<ColumnKey, number>;
  for (const key of columns.values()) counts[key] += 1;
  return counts;
}

/** 一集一句封面的直排短句：取第一個分句，超過八字就不放 */
export function shortLine(quote: string | null): string | null {
  const clause = quote?.split(/[，,。！？!?；;]/)[0]?.trim() ?? "";
  if (!clause || Array.from(clause).length > SHORT_LINE_MAX) return null;
  return `${clause}。`;
}

/** 「一百零一部作品，／六十四個人說過。」 */
export function heroLine(workCount: number, authorCount: number): [string, string] {
  if (workCount === 0) return ["索引還是空的，", "等第一個人說。"];
  return [`${workCount} 部作品，`, `${authorCount} 個人說過。`];
}

export function latestOf<T extends { publishedAt: string }>(items: ReadonlyArray<T>): T | null {
  return items.reduce<T | null>((latest, item) => (!latest || item.publishedAt > latest.publishedAt ? item : latest), null);
}
