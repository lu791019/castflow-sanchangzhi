import { dateStamp, logicalWeekday } from "@/lib/journal/wording";
import { formatIssueNo } from "@/lib/works/format";
import { feedIssueNo } from "./entries";

/** 桌機刊頭中央那一行（P4 桌機首頁目錄）：散場之後・第 0283 號・10 月 10 日 週六 */
export function mastheadIssueLine(date: Date): string {
  return `散場之後・${formatIssueNo(feedIssueNo(date))}・${dateStamp(date)} ${logicalWeekday(date)}`;
}
