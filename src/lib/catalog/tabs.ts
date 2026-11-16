/** 索引網址參數：?tab=works|authors|columns、?kind=<書架>（展開全部） */

import type { ShelfKind } from "./shelves";

export type CatalogTab = "works" | "authors" | "columns";

export const CATALOG_TABS: ReadonlyArray<{ tab: CatalogTab; label: string; href: string }> = [
  { tab: "works", label: "作品", href: "/catalog" },
  { tab: "authors", label: "作者", href: "/catalog?tab=authors" },
  { tab: "columns", label: "欄目", href: "/catalog?tab=columns" },
];

const SHELF_KINDS: ReadonlyArray<ShelfKind> = ["movie", "series", "podcast", "music", "performance", "exhibition"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogTab(value: string | string[] | undefined): CatalogTab {
  const raw = first(value);
  return CATALOG_TABS.find((item) => item.tab === raw)?.tab ?? "works";
}

export function parseShelfKind(value: string | string[] | undefined): ShelfKind | null {
  const raw = first(value);
  return SHELF_KINDS.find((kind) => kind === raw) ?? null;
}
