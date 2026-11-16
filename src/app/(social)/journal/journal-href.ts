/** 日誌頁網址（月份／檢視／展開某天都放在 query，可直接連結、可回上一頁） */

export interface JournalQuery {
  month: string;
  view: "cal" | "list";
  day: string | null;
}

export function journalHref({ month, view, day }: JournalQuery): string {
  const params = new URLSearchParams({ month });
  if (view === "list") params.set("view", "list");
  if (day && view === "cal") params.set("day", day);
  return `/journal?${params.toString()}`;
}
