import Link from "next/link";

/** 編輯檯每一篇旁的次要小連結：六平台社群貼文（舊的內容編輯器，Q-55）；沒產出就不顯示 */
export function DeskSocialLink({ href, title }: { href: string | null; title: string }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      aria-label={`社群貼文：${title}`}
      className="inline-flex min-h-11 items-center self-start text-caption text-ink-600 underline underline-offset-4"
    >
      社群貼文
    </Link>
  );
}
