import { renderShareOg } from "@/components/share/og/render-share-og";

export const dynamic = "force-dynamic";
export const alt = "散場誌";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** X／Twitter 大圖卡：與 OG 卡同一張 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareOg(slug);
}
