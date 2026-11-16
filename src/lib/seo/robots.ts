/** robots.txt 規則（純資料）：公開刊物可索引；私人頁、流程頁、API 不索引 */

export const ROBOTS_DISALLOW: readonly string[] = [
  "/api/",
  "/me",
  "/before",
  "/journal",
  "/notifications",
  "/say",
  "/proof/",
  "/login",
  "/auth/",
  "/onboarding/",
  "/dev/",
];

export function sitemapUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/sitemap.xml`;
}
