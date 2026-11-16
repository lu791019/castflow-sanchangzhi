import { renderShareOg } from "@/components/share/og/render-share-og";

export const dynamic = "force-dynamic";
export const alt = "散場誌";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 分享頁 OG 預覽卡（設計稿 P2 OG 預覽卡 A／B／C） */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareOg(slug);
}
