/** 索引畫面用的資料形狀（元件與 server 組裝共用） */

import type { ColumnKey } from "./columns";

export interface ArticleRowItem {
  key: string;
  href: string;
  date: string;
  title: string;
  columnName: string;
  workTitle: string | null;
  penName: string;
}

export interface ColumnCoverData {
  counts: Record<ColumnKey, number>;
  issueLabel: string;
  essayQuote: { quote: string; penName: string; workTitle: string | null } | null;
  oneLine: string | null;
  onsite: { title: string; date: string } | null;
}
