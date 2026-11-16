/**
 * 作者專欄頁網址（P3）：筆名在 profiles 是唯一的，直接當網址鍵。
 * 只有以筆名署名、公開發佈的文章能連到這裡；匿名署名不連、不露印章。
 */
export function authorPath(penName: string): string {
  return `/authors/${encodeURIComponent(penName)}`;
}
